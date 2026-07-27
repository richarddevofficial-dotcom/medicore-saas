"""
Comprehensive input validation for API endpoints.
Prevents injection attacks, malicious input, and data corruption.
"""

from django.core.exceptions import ValidationError
from django.utils.html import escape
import re
import bleach


class InputValidator:
    """Centralized input validation for APIs."""
    
    # Regex patterns for validation
    PATTERNS = {
        'email': r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
        'phone': r'^[\d\s\-\+\(\)]{7,20}$',
        'alphanumeric': r'^[a-zA-Z0-9_-]+$',
        'numeric': r'^\d+$',
        'username': r'^[a-zA-Z0-9_-]{3,50}$',
        'url': r'^https?://',
    }
    
    # SQL injection patterns
    SQL_INJECTION_PATTERNS = [
        r"(\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|SCRIPT)\b)",
        r"(;|-{2}|\/\*|\*\/|xp_|sp_)",
        r"('|\")\s*(OR|AND)\s*('|\")",
    ]
    
    # XSS patterns
    XSS_PATTERNS = [
        r"<script[^>]*>.*?</script>",
        r"javascript:",
        r"on(load|error|click|mouse)",
        r"<iframe",
        r"<object",
        r"<embed",
    ]
    
    @staticmethod
    def validate_email(email, allow_none=False):
        """Validate email format."""
        if not email:
            if allow_none:
                return None
            raise ValidationError("Email is required")
        
        email = str(email).strip().lower()
        
        if not re.match(InputValidator.PATTERNS['email'], email):
            raise ValidationError("Invalid email format")
        
        if len(email) > 254:  # RFC 5321
            raise ValidationError("Email too long")
        
        return email
    
    @staticmethod
    def validate_phone(phone, allow_none=False):
        """Validate phone number format."""
        if not phone:
            if allow_none:
                return None
            raise ValidationError("Phone is required")
        
        phone = str(phone).strip()
        
        if not re.match(InputValidator.PATTERNS['phone'], phone):
            raise ValidationError("Invalid phone format")
        
        # Remove non-digits and check length
        digits = re.sub(r'\D', '', phone)
        if len(digits) < 7 or len(digits) > 15:
            raise ValidationError("Phone number must be 7-15 digits")
        
        return phone
    
    @staticmethod
    def validate_username(username):
        """Validate username format."""
        if not username:
            raise ValidationError("Username is required")
        
        username = str(username).strip()
        
        if not re.match(InputValidator.PATTERNS['username'], username):
            raise ValidationError("Username must be 3-50 alphanumeric characters")
        
        return username
    
    @staticmethod
    def validate_password(password):
        """Validate password strength."""
        if not password:
            raise ValidationError("Password is required")
        
        password = str(password)
        
        if len(password) < 12:
            raise ValidationError("Password must be at least 12 characters")
        
        # Check for uppercase, lowercase, number, special char
        has_upper = any(c.isupper() for c in password)
        has_lower = any(c.islower() for c in password)
        has_digit = any(c.isdigit() for c in password)
        has_special = any(c in '!@#$%^&*()_+-=[]{}|;:,.<>?' for c in password)
        
        if not (has_upper and has_lower and has_digit):
            raise ValidationError(
                "Password must contain uppercase, lowercase, and numbers"
            )
        
        return password
    
    @staticmethod
    def validate_text(text, max_length=500, allow_html=False, allow_none=False):
        """Validate text input."""
        if not text:
            if allow_none:
                return None
            raise ValidationError("Text is required")
        
        text = str(text).strip()
        
        if len(text) > max_length:
            raise ValidationError(f"Text exceeds maximum length of {max_length}")
        
        # Check for SQL injection
        for pattern in InputValidator.SQL_INJECTION_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                raise ValidationError("Invalid characters or patterns detected")
        
        # Check for XSS if HTML not allowed
        if not allow_html:
            for pattern in InputValidator.XSS_PATTERNS:
                if re.search(pattern, text, re.IGNORECASE):
                    raise ValidationError("HTML/script content not allowed")
        
        return text
    
    @staticmethod
    def validate_html(html_text, max_length=5000):
        """Validate and sanitize HTML content."""
        if not html_text:
            return None
        
        html_text = str(html_text).strip()
        
        if len(html_text) > max_length:
            raise ValidationError(f"HTML exceeds maximum length of {max_length}")
        
        # Allowed HTML tags
        allowed_tags = ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3']
        allowed_attributes = {'a': ['href', 'target']}
        
        # Clean HTML
        cleaned = bleach.clean(
            html_text,
            tags=allowed_tags,
            attributes=allowed_attributes,
            strip=True
        )
        
        return cleaned
    
    @staticmethod
    def validate_numeric(value, min_value=None, max_value=None):
        """Validate numeric input."""
        if value is None:
            raise ValidationError("Numeric value is required")
        
        try:
            num = float(value)
        except (ValueError, TypeError):
            raise ValidationError("Invalid numeric value")
        
        if min_value is not None and num < min_value:
            raise ValidationError(f"Value must be >= {min_value}")
        
        if max_value is not None and num > max_value:
            raise ValidationError(f"Value must be <= {max_value}")
        
        return num
    
    @staticmethod
    def validate_enum(value, allowed_values, case_sensitive=False):
        """Validate against allowed values."""
        if not value:
            raise ValidationError("Value is required")
        
        value_str = str(value)
        check_values = allowed_values
        
        if not case_sensitive:
            value_str = value_str.lower()
            check_values = [v.lower() for v in allowed_values]
        
        if value_str not in check_values:
            raise ValidationError(f"Invalid value. Allowed: {', '.join(allowed_values)}")
        
        return value_str if case_sensitive else value
    
    @staticmethod
    def validate_json(json_str):
        """Validate JSON string."""
        if not json_str:
            raise ValidationError("JSON is required")
        
        import json
        try:
            return json.loads(json_str)
        except json.JSONDecodeError as exc:
            raise ValidationError(f"Invalid JSON: {exc}")
    
    @staticmethod
    def sanitize_text(text):
        """Remove potentially dangerous characters from text."""
        if not text:
            return text
        
        # Escape HTML
        text = escape(text)
        # Remove null bytes
        text = text.replace('\x00', '')
        # Remove control characters
        text = ''.join(c for c in text if ord(c) >= 32 or c in '\n\r\t')
        
        return text
