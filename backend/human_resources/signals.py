from django.db import connection
from django.db.models.signals import post_save
from django.dispatch import receiver

from hospitals.models import Hospital

from .leave_type_defaults import seed_default_leave_types


@receiver(post_save, sender=Hospital)
def create_default_leave_types(sender, instance, created, **kwargs):
    leave_type_table_exists = (
        "human_resources_leavetype" in connection.introspection.table_names()
    )
    if created and leave_type_table_exists:
        seed_default_leave_types(instance)
