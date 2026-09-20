"""Molecular structure resolution and retrieval endpoints."""

import os
import re
import uuid
import logging
import threading
import urllib.request
import urllib.error
import urllib.parse
from typing import Optional, Literal
from fastapi import APIRouter, HTTPException, Query, Response
from backend.app.config import settings

logger = logging.getLogger("mocs.molecular")
router = APIRouter()

# Strict validation regexes
PDB_ID_REGEX = re.compile(r"^[0-9a-zA-Z]{4}$")
UNIPROT_ID_REGEX = re.compile(r"^[A-Z0-9]{6,10}$")
MODEL_ARCHIVE_ID_REGEX = re.compile(r"^ma-[a-z0-9-]{1,32}$")
MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024  # 50 MB safety cap
DOWNLOAD_TIMEOUT_SECONDS = 10  # Reduced bounded timeout (P2-2)
DOWNLOAD_SEMAPHORE = threading.BoundedSemaphore(value=5)  # Concurrency cap (P2-2)

@router.get("/structure")
def get_molecular_structure(
    source: Literal["rcsb", "alphafold", "model_archive", "local"] = Query("rcsb", description="Structure repository source"),
    pdb_id: Optional[str] = Query(None, alias="pdbId", description="4-character PDB ID"),
    uniprot_id: Optional[str] = Query(None, alias="uniprotId", description="UniProt Accession ID"),
    assembly_id: Optional[str] = Query(None, alias="assemblyId", description="Biological assembly ID"),
    format: Optional[Literal["bcif", "cif", "mmcif", "pdb"]] = Query(None, description="Structure file format"),
    meta_only: bool = Query(False, alias="metaOnly", description="Return metadata envelope only")
):
    """Securely resolves and streams molecular structure files with provenance metadata."""

    # 1. Validate inputs and construct upstream source target
    if source == "rcsb":
        if not pdb_id:
            raise HTTPException(status_code=400, detail="Missing required pdbId for RCSB source.")
        clean_pdb = pdb_id.strip().upper()
        if not PDB_ID_REGEX.match(clean_pdb):
            raise HTTPException(status_code=400, detail=f"Invalid PDB ID format: '{pdb_id}'. Must be 4 alphanumeric characters.")
        
        resolved_format = format or "bcif"
        model_id = clean_pdb
        provider = "RCSB PDB"
        experimental = True
        
        # P2-4: Handle assembly_id properly via RCSB biological assembly endpoints
        is_assembly = assembly_id and assembly_id not in ("0", "default", "none")
        if resolved_format == "bcif":
            if is_assembly:
                upstream_url = f"https://models.rcsb.org/v1/{clean_pdb}/assembly?assembly_id={assembly_id}"
            else:
                upstream_url = f"https://models.rcsb.org/{clean_pdb}.bcif"
            media_type = "application/octet-stream"
        elif resolved_format in ("cif", "mmcif"):
            if is_assembly and assembly_id != "1":
                raise HTTPException(
                    status_code=501,
                    detail=f"Non-default biological assembly '{assembly_id}' for format '{resolved_format}' is not directly streamable uncompressed. Please request format='bcif' for biological assembly retrieval."
                )
            upstream_url = f"https://files.rcsb.org/download/{clean_pdb}.cif"
            media_type = "chemical/x-mmcif"
        else:
            if is_assembly and assembly_id != "1":
                raise HTTPException(
                    status_code=501,
                    detail=f"Non-default biological assembly '{assembly_id}' for format '{resolved_format}' is not directly streamable uncompressed. Please request format='bcif' for biological assembly retrieval."
                )
            upstream_url = f"https://files.rcsb.org/download/{clean_pdb}.pdb"
            media_type = "chemical/x-pdb"

    elif source == "alphafold":
        if not uniprot_id:
            raise HTTPException(status_code=400, detail="Missing required uniprotId for AlphaFold source.")
        clean_uniprot = uniprot_id.strip().upper()
        if not UNIPROT_ID_REGEX.match(clean_uniprot):
            raise HTTPException(status_code=400, detail=f"Invalid UniProt ID format: '{uniprot_id}'.")
        
        resolved_format = format or "cif"
        model_id = f"AF-{clean_uniprot}-F1"
        provider = "AlphaFold DB"
        experimental = False
        
        # P2-5: Honor requested format in AlphaFold queries
        if resolved_format == "pdb":
            upstream_url = f"https://alphafold.ebi.ac.uk/files/{model_id}-model_v4.pdb"
            media_type = "chemical/x-pdb"
        elif resolved_format == "bcif":
            upstream_url = f"https://alphafold.ebi.ac.uk/files/{model_id}-model_v4.bcif"
            media_type = "application/octet-stream"
        else:
            resolved_format = "cif"
            upstream_url = f"https://alphafold.ebi.ac.uk/files/{model_id}-model_v4.cif"
            media_type = "chemical/x-mmcif"

    elif source == "model_archive":
        model_id_param = pdb_id or uniprot_id
        if not model_id_param:
            raise HTTPException(status_code=400, detail="Missing required ID for ModelArchive source.")
        clean_maid = model_id_param.strip().lower()
        # P2-1: Strict regex validation and URL quotation
        if not MODEL_ARCHIVE_ID_REGEX.match(clean_maid):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid ModelArchive accession ID format: '{clean_maid}'. Expected format 'ma-[a-z0-9-]{{1,32}}'."
            )
        encoded_maid = urllib.parse.quote(clean_maid, safe="")
        model_id = clean_maid
        provider = "ModelArchive"
        experimental = False
        resolved_format = "cif"
        upstream_url = f"https://www.modelarchive.org/api/projects/{encoded_maid}?format=cif"
        media_type = "chemical/x-mmcif"

    elif source == "local":
        # P2-3: Strictly jailed local structure loader within settings.DATA_ROOT
        model_id_param = pdb_id or uniprot_id
        if not model_id_param:
            raise HTTPException(status_code=400, detail="Missing required structure identifier (pdbId or uniprotId) for local source.")
        
        # Check path traversal tokens
        if ".." in model_id_param or "/" in model_id_param or "\\" in model_id_param or "\x00" in model_id_param:
            raise HTTPException(status_code=400, detail="Invalid structure filename: path traversal not permitted.")
        
        candidate_path = os.path.realpath(os.path.join(settings.DATA_ROOT, model_id_param))
        data_root_real = os.path.realpath(settings.DATA_ROOT)
        if not candidate_path.startswith(data_root_real):
            raise HTTPException(status_code=403, detail="Access denied: requested file is outside DATA_ROOT jail.")
        
        if not os.path.isfile(candidate_path):
            preferred_ext = format or "pdb"
            ext_candidate = f"{candidate_path}.{preferred_ext}"
            if os.path.isfile(ext_candidate):
                candidate_path = ext_candidate
            else:
                raise HTTPException(status_code=404, detail=f"Local structure '{model_id_param}' not found in DATA_ROOT.")
        
        model_id = os.path.basename(candidate_path)
        provider = "Local Filesystem"
        experimental = True
        upstream_url = f"file://{candidate_path}"
        
        if candidate_path.endswith(".bcif"):
            resolved_format = "bcif"
            media_type = "application/octet-stream"
        elif candidate_path.endswith(".pdb"):
            resolved_format = "pdb"
            media_type = "chemical/x-pdb"
        else:
            resolved_format = "cif"
            media_type = "chemical/x-mmcif"

    else:
        raise HTTPException(status_code=400, detail=f"Unsupported structure source: {source}")

    # 2. Metadata-only response
    if meta_only:
        return {
            "source": source,
            "provider": provider,
            "model_id": model_id,
            "format": resolved_format,
            "experimental": experimental,
            "source_url": upstream_url,
            "assembly_id": assembly_id
        }

    # 3. Local file retrieval (jailed)
    if source == "local":
        with open(candidate_path, "rb") as f:
            content = f.read(MAX_DOWNLOAD_BYTES + 1)
        if len(content) > MAX_DOWNLOAD_BYTES:
            raise HTTPException(status_code=413, detail="Structure file exceeds maximum permitted size of 50 MB.")
        
        headers = {
            "X-MOCS-Source": source,
            "X-MOCS-Provider": provider,
            "X-MOCS-Model-Id": model_id,
            "X-MOCS-Experimental": str(experimental).lower(),
            "X-MOCS-Format": resolved_format,
            "Cache-Control": "public, max-age=86400",
        }
        return Response(content=content, media_type=media_type, headers=headers)

    # 4. Upstream network fetch with concurrency limit (P2-2) & bounded download
    parsed_url = urllib.parse.urlparse(upstream_url)
    allowed_hosts = {"models.rcsb.org", "files.rcsb.org", "alphafold.ebi.ac.uk", "www.modelarchive.org"}
    if parsed_url.scheme.lower() != "https" or parsed_url.netloc.lower() not in allowed_hosts:
        raise HTTPException(status_code=400, detail="Disallowed or untrusted upstream structure destination.")

    acquired = DOWNLOAD_SEMAPHORE.acquire(timeout=5.0)
    if not acquired:
        raise HTTPException(status_code=503, detail="Structure download service busy. Please retry shortly.")

    try:
        req = urllib.request.Request(
            upstream_url,
            headers={
                "User-Agent": "MOCS-Cert/1.0 (Computational Biophysics; Certified Query Execution)"
            }
        )
        with urllib.request.urlopen(req, timeout=DOWNLOAD_TIMEOUT_SECONDS) as resp:  # nosec B310
            content = resp.read(MAX_DOWNLOAD_BYTES + 1)
            if len(content) > MAX_DOWNLOAD_BYTES:
                raise HTTPException(status_code=413, detail="Structure file exceeds maximum permitted size of 50 MB.")
            
            headers = {
                "X-MOCS-Source": source,
                "X-MOCS-Provider": provider,
                "X-MOCS-Model-Id": model_id,
                "X-MOCS-Experimental": str(experimental).lower(),
                "X-MOCS-Format": resolved_format,
                "Cache-Control": "public, max-age=86400",
            }
            return Response(content=content, media_type=media_type, headers=headers)

    except urllib.error.HTTPError as e:
        if e.code == 404:
            raise HTTPException(status_code=404, detail=f"Structure '{model_id}' not found in {provider}.")
        # P2-6: Structured log + correlation ID
        corr_id = uuid.uuid4().hex[:8]
        logger.warning(f"[{corr_id}] Upstream HTTP {e.code} from {provider} ({upstream_url}): {e.reason}")
        raise HTTPException(status_code=502, detail=f"Upstream provider error from {provider} (ref: {corr_id}).")
    except urllib.error.URLError as e:
        corr_id = uuid.uuid4().hex[:8]
        logger.warning(f"[{corr_id}] Network error connecting to {provider} ({upstream_url}): {e.reason}")
        raise HTTPException(status_code=504, detail=f"Network error connecting to {provider} (ref: {corr_id}).")
    except HTTPException:
        raise
    except Exception as e:
        corr_id = uuid.uuid4().hex[:8]
        logger.exception(f"[{corr_id}] Unexpected error retrieving structure '{model_id}': {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error while retrieving structure (ref: {corr_id}).")
    finally:
        DOWNLOAD_SEMAPHORE.release()
