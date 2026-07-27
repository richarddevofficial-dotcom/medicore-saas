"""
Encryption utilities for backup files.
Ensures backups are encrypted before transmission or storage.
"""

import os
import gzip
import json
from cryptography.fernet import Fernet
from django.conf import settings
from django.utils import timezone
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class BackupEncryption:
    """Encrypt and decrypt database backups."""
    
    @staticmethod
    def get_backup_key():
        """Get or generate backup encryption key."""
        key = os.environ.get('BACKUP_ENCRYPTION_KEY')
        if not key:
            # Generate new key if not set
            key = Fernet.generate_key().decode()
            logger.warning("Generated temporary backup key - set BACKUP_ENCRYPTION_KEY in production")
        return key.encode() if isinstance(key, str) else key
    
    @staticmethod
    def encrypt_backup(backup_data, backup_name=None):
        """
        Encrypt backup file.
        
        Args:
            backup_data: Raw backup data (bytes)
            backup_name: Name of backup for metadata
        
        Returns:
            Dict with encrypted data, key, metadata
        """
        try:
            key = BackupEncryption.get_backup_key()
            cipher = Fernet(key)
            
            # Compress backup first (reduces size ~70%)
            compressed = gzip.compress(backup_data)
            
            # Encrypt compressed data
            encrypted = cipher.encrypt(compressed)
            
            # Create metadata
            metadata = {
                'timestamp': timezone.now().isoformat(),
                'backup_name': backup_name or f"backup-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
                'algorithm': 'Fernet-AES128',
                'compressed': True,
                'original_size': len(backup_data),
                'encrypted_size': len(encrypted),
                'compression_ratio': f"{(1 - len(encrypted)/len(backup_data))*100:.1f}%",
            }
            
            logger.info(f"✓ Backup encrypted: {metadata['backup_name']}")
            
            return {
                'encrypted_data': encrypted,
                'metadata': metadata,
                'key_needed': True,  # Flag that key is required to decrypt
            }
        except Exception as exc:
            logger.error(f"❌ Backup encryption failed: {exc}")
            raise
    
    @staticmethod
    def decrypt_backup(encrypted_data, key=None):
        """
        Decrypt backup file.
        
        Args:
            encrypted_data: Encrypted backup data (bytes)
            key: Decryption key (uses env var if not provided)
        
        Returns:
            Decompressed backup data (bytes)
        """
        try:
            if key is None:
                key = BackupEncryption.get_backup_key()
            
            if isinstance(key, str):
                key = key.encode()
            
            cipher = Fernet(key)
            
            # Decrypt
            compressed = cipher.decrypt(encrypted_data)
            
            # Decompress
            backup_data = gzip.decompress(compressed)
            
            logger.info("✓ Backup decrypted successfully")
            return backup_data
        except Exception as exc:
            logger.error(f"❌ Backup decryption failed: {exc}")
            raise
    
    @staticmethod
    def create_backup_manifest(backups_info):
        """
        Create manifest file listing all backups.
        
        Args:
            backups_info: List of backup metadata dicts
        
        Returns:
            JSON manifest content
        """
        manifest = {
            'created_at': timezone.now().isoformat(),
            'total_backups': len(backups_info),
            'backups': backups_info,
            'note': 'This manifest requires BACKUP_ENCRYPTION_KEY to decrypt individual backups'
        }
        return json.dumps(manifest, indent=2)


class BackupScheduler:
    """Schedule automated encrypted backups."""
    
    # Backup schedule
    BACKUP_SCHEDULE = {
        'hourly': {
            'frequency': 'every_hour',
            'retention': 24,  # Keep 24 hourly backups
            'encryption': True,
        },
        'daily': {
            'frequency': 'daily_at_02_am',
            'retention': 30,  # Keep 30 daily backups
            'encryption': True,
        },
        'weekly': {
            'frequency': 'weekly_sunday',
            'retention': 12,  # Keep 12 weekly backups
            'encryption': True,
        },
        'monthly': {
            'frequency': 'monthly_first',
            'retention': 12,  # Keep 12 monthly backups
            'encryption': True,
        },
    }
    
    @staticmethod
    def get_retention_policy():
        """Get backup retention policy."""
        return BackupScheduler.BACKUP_SCHEDULE
    
    @staticmethod
    def should_backup_be_deleted(backup_creation_time, backup_type):
        """
        Check if backup should be deleted based on retention policy.
        
        Args:
            backup_creation_time: datetime of backup creation
            backup_type: Type of backup ('hourly', 'daily', etc.)
        
        Returns:
            True if backup is older than retention period
        """
        if backup_type not in BackupScheduler.BACKUP_SCHEDULE:
            return False
        
        retention_days = BackupScheduler.BACKUP_SCHEDULE[backup_type]['retention']
        retention_time = timezone.now() - timezone.timedelta(days=retention_days)
        
        return backup_creation_time < retention_time
