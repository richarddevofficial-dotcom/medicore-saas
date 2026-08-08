from django.apps import AppConfig


class HumanResourcesConfig(AppConfig):
    name = 'human_resources'

    def ready(self):
        from . import signals  # noqa: F401
