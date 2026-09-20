"""MOCS-Cert FastAPI ASGI Main Application."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from contextlib import asynccontextmanager
from backend.app.config import settings
from backend.app.core.trajectory_service import get_trajectory_service, close_trajectory_service
from backend.app.api.endpoints import (
    trajectories,
    query,
    certificates,
    refinement,
    benchmarks,
    molecular,
    workflow
)
from backend.app.api.websockets import query_stream
from mocs.arrays import detect_optimal_backend
import mocs

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize trajectory service
    try:
        get_trajectory_service()
    except Exception as e:
        import logging
        logging.getLogger("uvicorn.error").warning(f"Initial trajectory load deferred: {e}")
    yield
    # Shutdown: clean up resources
    close_trajectory_service()

app = FastAPI(
    title="MOCS-Cert Server",
    description="Molecular Observability Compiler for Certified Query Execution API",
    version=mocs.__version__,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"^https://([a-zA-Z0-9_-]+\.)*(pages\.dev|workers\.dev|onrender\.com)$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Accept", "Content-Type", "Origin"],
)

# Mount REST endpoints
app.include_router(trajectories.router, prefix=f"{settings.API_V1_STR}/trajectories", tags=["Trajectories"])
app.include_router(query.router, prefix=f"{settings.API_V1_STR}/query", tags=["Query"])
app.include_router(certificates.router, prefix=f"{settings.API_V1_STR}/certificates", tags=["Certificates"])
app.include_router(refinement.router, prefix=f"{settings.API_V1_STR}/refine", tags=["Refinement"])
app.include_router(benchmarks.router, prefix=f"{settings.API_V1_STR}/benchmarks", tags=["Benchmarks"])
app.include_router(molecular.router, prefix=f"{settings.API_V1_STR}/molecular", tags=["Molecular"])
# P2-7: Mount alias routes with include_in_schema=False to prevent OpenAPI route duplication
app.include_router(molecular.router, prefix="/api/molecular", include_in_schema=False)
app.include_router(workflow.router, prefix=f"{settings.API_V1_STR}/workflow", tags=["Workflow Engine"])
app.include_router(workflow.router, prefix="/api/workflow", include_in_schema=False)

# Mount WebSockets
app.include_router(query_stream.router, prefix="/ws", tags=["WebSockets"])

from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from mocs.exceptions import (
    MOCSQuerySyntaxError,
    MOCSSelectionResolutionError,
    MOCSUnsupportedGeometryError,
    MOCSFileNotFoundError,
    MOCSDataIntegrityError,
    MOCSVerificationError
)

@app.exception_handler(MOCSUnsupportedGeometryError)
async def unsupported_geometry_error_handler(request: Request, exc: MOCSUnsupportedGeometryError):
    return JSONResponse(
        status_code=400,
        content={
            "error_code": "UNSUPPORTED_GEOMETRY",
            "message": str(exc),
            "detail": str(exc),
            "error_type": "MOCSUnsupportedGeometryError",
            "location": "Simulation Box Geometry",
            "action": "Supported simulation cells include orthorhombic and valid non-degenerate triclinic cells (det > 0, cond < 1e12). Degenerate, zero-volume, or collinear cell geometries are rejected."
        }
    )

@app.exception_handler(MOCSSelectionResolutionError)
async def selection_resolution_error_handler(request: Request, exc: MOCSSelectionResolutionError):
    msg = str(exc)
    location = "Selection B" if any(k in msg.lower() for k in ["sel_b", "selection b", "operand b"]) else "Selection A"
    return JSONResponse(
        status_code=400,
        content={
            "error_code": "INVALID_SELECTION",
            "message": msg,
            "detail": msg,
            "error_type": "MOCSSelectionResolutionError",
            "location": location,
            "action": "Verify that the residue names, atom names, or indices exist in the loaded topology (e.g. 'name CA', 'name O2', 'resid 155')."
        }
    )

@app.exception_handler(MOCSQuerySyntaxError)
async def query_syntax_error_handler(request: Request, exc: MOCSQuerySyntaxError):
    return JSONResponse(
        status_code=400,
        content={
            "error_code": "PARSE_FAILED",
            "message": str(exc),
            "detail": str(exc),
            "error_type": "MOCSQuerySyntaxError",
            "location": "Query Syntax",
            "action": "Check MolQL query syntax: FIND (<selection>) WITHIN <distance>A OF (<selection>) [WHERE DURATION >= <time>]."
        }
    )

@app.exception_handler(MOCSFileNotFoundError)
async def file_not_found_error_handler(request: Request, exc: MOCSFileNotFoundError):
    return JSONResponse(
        status_code=404,
        content={
            "error_code": "MISSING_DATA",
            "message": str(exc),
            "detail": str(exc),
            "error_type": "MOCSFileNotFoundError",
            "location": "Trajectory / Topology File",
            "action": "Verify that declared trajectory and topology files exist on the server."
        }
    )

@app.exception_handler(MOCSDataIntegrityError)
async def data_integrity_error_handler(request: Request, exc: MOCSDataIntegrityError):
    return JSONResponse(
        status_code=422,
        content={
            "error_code": "DATA_INTEGRITY_VIOLATION",
            "message": str(exc),
            "detail": str(exc),
            "error_type": "MOCSDataIntegrityError",
            "location": "MCI / Trajectory SHA-256 Digest",
            "action": "Re-index the trajectory using MCIWriter or verify file hashes."
        }
    )

@app.exception_handler(MOCSVerificationError)
async def verification_error_handler(request: Request, exc: MOCSVerificationError):
    return JSONResponse(
        status_code=422,
        content={
            "error_code": "VERIFICATION_FAILED",
            "message": str(exc),
            "detail": str(exc),
            "error_type": "MOCSVerificationError",
            "location": "Execution Certificate",
            "action": "Cryptographic certificate verification failed. Check mathematical proofs and SHA-256 commitments."
        }
    )

@app.exception_handler(RequestValidationError)
async def request_validation_error_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "error_code": "INVALID_REQUEST_SCHEMA",
            "message": "Request payload failed schema validation.",
            "detail": str(exc.errors()),
            "error_type": "RequestValidationError",
            "location": "Request Body",
            "action": "Verify that the request JSON contains all required fields with appropriate types."
        }
    )

def _format_accelerator(backend: str) -> str:
    if backend in ("cupy", "jax", "torch"):
        return f"GPU ({backend.upper()} Accelerated)"
    return "CPU (NumPy Vectorized)"

@app.get("/")
def root_endpoint():
    backend = detect_optimal_backend("auto")
    return {
        "status": "online",
        "version": mocs.__version__,
        "array_backend": backend,
        "active_accelerator": _format_accelerator(backend)
    }

@app.get("/api/v1/health")
def health_check():
    backend = detect_optimal_backend("auto")
    return {
        "status": "healthy",
        "version": mocs.__version__,
        "array_backend": backend,
        "active_accelerator": _format_accelerator(backend)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host=settings.DEFAULT_HOST, port=settings.DEFAULT_PORT, reload=True)
