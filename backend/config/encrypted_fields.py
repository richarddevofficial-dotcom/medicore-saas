"""
Custom Django model fields with automatic encryption/decryption.
"""

from django.db import models
from config.encryption import encrypt_value, decrypt_value


class EncryptedCharField(models.CharField):
    """
    CharField that automatically encrypts data before storing and decrypts when retrieving.
    Use for: national ID, passport, SSN, etc.
    """
    
    def __init__(self, *args, **kwargs):
        # Increase max_length since encrypted data is larger
        if 'max_length' not in kwargs:
            kwargs['max_length'] = 500
        super().__init__(*args, **kwargs)
    
    def get_prep_value(self, value):
        """Encrypt value before saving to database."""
        if not value:
            return None if self.null else ""
        return encrypt_value(value)
    
    def from_db_value(self, value, expression, connection):
        """Decrypt value when retrieving from database."""
        if value is None:
            return None
        try:
            return decrypt_value(value)
        except Exception:
            # If decryption fails, return encrypted value (indicates key mismatch)
            return value


class EncryptedTextField(models.TextField):
    """
    TextField that automatically encrypts data before storing and decrypts when retrieving.
    Use for: long text containing sensitive information.
    """
    
    def get_prep_value(self, value):
        """Encrypt value before saving to database."""
        if not value:
            return None if self.null else ""
        return encrypt_value(value)
    
    def from_db_value(self, value, expression, connection):
        """Decrypt value when retrieving from database."""
        if value is None:
            return None
        try:
            return decrypt_value(value)
        except Exception:
            return value


class EncryptedEmailField(models.EmailField):
    """
    EmailField that encrypts sensitive email addresses.
    Use for: secondary emails, alternative contacts.
    """
    
    def __init__(self, *args, **kwargs):
        if 'max_length' not in kwargs:
            kwargs['max_length'] = 500
        super().__init__(*args, **kwargs)
    
    def get_prep_value(self, value):
        """Encrypt value before saving to database."""
        if not value:
            return None if self.null else ""
        return encrypt_value(value)
    
    def from_db_value(self, value, expression, connection):
        """Decrypt value when retrieving from database."""
        if value is None:
            return None
        try:
            return decrypt_value(value)
        except Exception:
            return value
