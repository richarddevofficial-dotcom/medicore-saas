"""
Encryption utilities for sensitive data at rest.
Uses Fernet (AES-128) from cryptography library for deterministic encryption.
"""

from cryptography.fernet import Fernet
from django.conf import settings
import os
import base64


def get_encryption_key():
    """
    Get encryption key from environment or generate it.
    In production, this MUST be set via environment variable.
    """
    key = os.environ.get('ENCRYPTION_KEY')
    
    if not key:
        # Generate a new key if not set (development only)
        # In production: ENCRYPTION_KEY=<base64-encoded-key> python manage.py ...
        key = base64.urlsafe_b64encode(os.urandom(32)).decode()
    
    return key.encode() if isinstance(key, str) else key


def encrypt_value(value):
    """
    Encrypt a string value using Fernet (symmetric encryption).
    Returns encrypted bytes encoded as base64 string.
    """
    if not value:
        return None
    
    value_str = str(value) if not isinstance(value, str) else value
    key = get_encryption_key()
    
    try:
        f = Fernet(key)
        encrypted = f.encrypt(value_str.encode())
        return encrypted.decode()
    except Exception as exc:
        raise ValueError(f"Encryption failed: {exc}")


def decrypt_value(encrypted_value):
    """
    Decrypt a Fernet-encrypted value.
    Returns decrypted string.
    """
    if not encrypted_value:
        return None
    
    key = get_encryption_key()
    
    try:
        f = Fernet(key)
        decrypted = f.decrypt(encrypted_value.encode())
        return decrypted.decode()
    except Exception as exc:
        raise ValueError(f"Decryption failed: {exc}")


def mask_sensitive_value(value, show_last_n=4):
    """
    Mask sensitive value for display (e.g., bank account *****1234).
    """
    if not value:
        return "****"
    
    value_str = str(value)
    if len(value_str) <= show_last_n:
        return "*" * len(value_str)
    
    masked_count = len(value_str) - show_last_n
    return "*" * masked_count + value_str[-show_last_n:]
