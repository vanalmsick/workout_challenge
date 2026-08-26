from django.core.management import BaseCommand
from django.contrib.auth import get_user_model

class Command(BaseCommand):
    """Add additional test data"""

    # Show this when the user types help
    help = "Give user staff status"

    def add_arguments(self, parser):
        parser.add_argument("email", nargs="?", type=str, help="Email of the user to promote to staff")

    def handle(self, *args, **options):
        """Actual Commandline executed function when manage.py command is called"""
        User = get_user_model()
        email = options.get("email")

        if not email:
            email = input("Enter the email of the user to promote to staff: ")

        try:
            user = User.objects.get(email__iexact=email.strip())
            user.is_staff = True
            user.save()
            self.stdout.write(self.style.SUCCESS(f"User {email} is now staff."))
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"No user found with email {email}"))