from rest_framework import serializers


class LowercaseEmailField(serializers.EmailField):
    """
    EmailField that normalises the address to lower case.

    The normalisation happens in ``to_internal_value``, i.e. *before* the field's
    validators (``EmailValidator``, ``UniqueValidator``) and before any
    ``validate_<field>`` hook run. That ordering matters: it is what makes the
    uniqueness check and every lookup built from the value case-insensitive.
    Doing it in ``validate_email`` instead would be too late.
    """

    def to_internal_value(self, data):
        value = super().to_internal_value(data)
        return value.strip().lower()
