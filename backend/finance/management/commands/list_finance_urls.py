from django.core.management.base import BaseCommand
from django.urls import URLPattern, URLResolver, get_resolver


class Command(BaseCommand):
    help = "Lists all registered Finance API URLs."

    def add_arguments(self, parser):
        parser.add_argument(
            "--contains",
            default="finance",
            help="Only display routes containing this text.",
        )

    def handle(self, *args, **options):
        search_text = options["contains"].lower()
        routes = []

        def collect_patterns(patterns, prefix=""):
            for pattern in patterns:
                current = f"{prefix}{pattern.pattern}"

                if isinstance(pattern, URLPattern):
                    route_name = pattern.name or ""
                    callback = getattr(
                        pattern.callback,
                        "__name__",
                        pattern.callback.__class__.__name__,
                    )

                    routes.append(
                        {
                            "route": current,
                            "name": route_name,
                            "callback": callback,
                        }
                    )

                elif isinstance(pattern, URLResolver):
                    collect_patterns(
                        pattern.url_patterns,
                        current,
                    )

        collect_patterns(get_resolver().url_patterns)

        filtered = [
            item
            for item in routes
            if search_text in item["route"].lower()
            or search_text in item["name"].lower()
        ]

        if not filtered:
            self.stdout.write(
                self.style.WARNING(
                    f"No URLs found containing '{search_text}'."
                )
            )
            return

        self.stdout.write(
            self.style.SUCCESS(
                f"Found {len(filtered)} matching URLs:\n"
            )
        )

        for item in filtered:
            self.stdout.write(
                f"{item['route']:<80} "
                f"name={item['name']:<35} "
                f"view={item['callback']}"
            )
