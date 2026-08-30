"""MOCS-Cert Structured Exception Hierarchy."""

class MOCSError(Exception):
    """Base exception for all errors raised by MOCS-Cert."""
    pass

class MOCSFileNotFoundError(MOCSError, FileNotFoundError):
    """Raised when declared trajectory or topology files cannot be found on disk."""
    pass

class MOCSDataIntegrityError(MOCSError):
    """Raised when SHA-256 digests do not match recorded provenance manifests."""
    pass

class MOCSInvalidTopologyError(MOCSError):
    """Raised when atom selectors fail to resolve, or topology connectivity is missing."""
    pass

class MOCSUnsupportedGeometryError(MOCSError, ValueError):
    """Raised when encountering non-orthorhombic, triclinic, or variable-volume simulation cells."""
    pass

class MOCSSelectionResolutionError(MOCSError, ValueError):
    """Raised when an atom selection string matches 0 atoms or >1 atom in pairwise mode."""
    pass

class MOCSStaleIndexError(MOCSError):
    """Raised when sidecar index files fail cryptographic validity checks against source files."""
    pass

class MOCSVerificationError(MOCSError):
    """Raised when a certificate fails mathematical or provenance audit."""
    pass

class MOCSQuerySyntaxError(MOCSError, ValueError):
    """Raised when a scientific MolQL query string fails lexical or grammar parsing."""
    pass

class MOCSBlockNotFoundError(MOCSError, KeyError):
    """Raised when a requested block ID cannot be found in the index."""
    pass
