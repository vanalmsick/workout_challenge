from django.core.exceptions import DisallowedHost
from django.http import JsonResponse
from django.middleware.csrf import CsrfViewMiddleware
from django.utils.deprecation import MiddlewareMixin

class JsonSecurityErrorMiddleware(MiddlewareMixin):
    def process_exception(self, request, exception):
        # Add detailed logging
        print("=== Debug Information ===")
        print(f"Request Host: {request.get_host()}")
        print(f"Request Headers: {dict(request.headers)}")
        print(f"Exception type: {type(exception)}")
        print(f"Exception message: {str(exception)}")
        print("======================")
        # Invalid Host (ALLOWED_HOSTS violation)
        if isinstance(exception, DisallowedHost):
            return JsonResponse(
                {"error": "Request host not allowed. Please add the url/host to the env variable HOSTS.", "code": "invalid_host"},
                status=403
            )

        # CSRF failure
        if isinstance(exception, CsrfViewMiddleware.Reason):
            return JsonResponse(
                {"error": "CSRF verification failed. Please add the url/host to the env variable HOSTS.", "code": "csrf_failed"},
                status=403
            )

        return None  # Let Django handle other exceptions