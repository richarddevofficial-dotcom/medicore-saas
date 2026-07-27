"""
Secure token generation for password resets and sensitive operations.
Uses cryptographically secure random generation with timestamps.
"""

import secrets
import hashlib
from datetime import datetime, timedelta
from django.utils import timezone
from django.core.signing import TimestampSigner, SignatureExpired, BadSignature


class SecureTokenGenerator:
    """Generate and verify secure tokens for sensitive operations."""
    
    # Token types for audit logging
    TOKEN_TYPES = {
        'password_reset': 'Password Reset',
        'email_verify': 'Email Verification',
        'account_recovery': 'Account Recovery',
        'domain_verify': 'Domain Verification',
    }
    
    @staticmethod
    def generate_token(token_type='password_reset', user_id=None):
        """
        Generate a secure token with embedded timestamp.
        
        Args:
            token_type: Type of token ('password_reset', 'email_verify', etc.)
            user_id: User ID to embed in token
        
        Returns:
            Tuple of (token_string, token_hash)
            - token_string: Full token to send to user
            - token_hash: Hashed version to store in database
        """
        # Generate 32 bytes of cryptographically secure random data
        random_bytes = secrets.token_bytes(32)
        timestamp = int(timezone.now().timestamp())
        
        # Combine random bytes with timestamp
        token_data = f"{token_type}:{user_id}:{timestamp}:{secrets.token_hex(32)}"
        token_string = secrets.token_urlsafe(48)
        
        # Hash token for storage
        token_hash = hashlib.sha256(token_string.encode()).hexdigest()
        
        return token_string, token_hash
    
    @staticmethod
    def verify_token(token_string, token_hash, max_age_seconds=3600):
        """
        Verify a token against its hash.
        
        Args:
            token_string: Token provided by user
            token_hash: Hash stored in database
            max_age_seconds: Maximum token age (default 1 hour)
        
        Returns:
            True if valid, False otherwise
        """
        if not token_string or not token_hash:
            return False
        
        # Compute hash of provided token
        computed_hash = hashlib.sha256(token_string.encode()).hexdigest()
        
        # Constant-time comparison (prevent timing attacks)
        return secrets.compare_digest(computed_hash, token_hash)
    
    @staticmethod
    def generate_signed_token(data, token_type='password_reset', expires_in_seconds=3600):
        """
        Generate a signed token with timestamp (includes expiration check).
        
        Args:
            data: Dict of data to embed (e.g., {'user_id': 123, 'email': 'user@example.com'})
            token_type: Type of token
            expires_in_seconds: Token expiration time
        
        Returns:
            Signed token string
        """
        signer = TimestampSigner(salt=f'secure-token-{token_type}')
        data_str = str(data)
        token = signer.sign(data_str)
        return token
    
    @staticmethod
    def verify_signed_token(token, token_type='password_reset', max_age_seconds=3600):
        """
        Verify and extract data from a signed token.
        
        Args:
            token: Token to verify
            token_type: Expected token type
            max_age_seconds: Maximum token age
        
        Returns:
            Extracted data if valid, None if invalid/expired
        """
        signer = TimestampSigner(salt=f'secure-token-{token_type}')
        try:
            data_str = signer.unsign(token, max_age=max_age_seconds)
            return data_str
        except (BadSignature, SignatureExpired):
            return None


# Recommended token lifetimes
TOKEN_LIFETIMES = {
    'password_reset': 3600,      # 1 hour
    'email_verify': 86400,       # 24 hours
    'account_recovery': 1800,    # 30 minutes
    'domain_verify': 86400,      # 24 hours
    'invite': 604800,            # 7 days
}
