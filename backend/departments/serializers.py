from rest_framework import serializers
from human_resources.permissions import get_user_hospital_id

from .models import Department

class DepartmentSerializer(serializers.ModelSerializer):
    rooms = serializers.IntegerField(min_value=0)

    class Meta:
        model = Department
        fields = ['id', 'name', 'description', 'rooms', 'is_active', 'created_at']
        read_only_fields = ['hospital', 'created_at']

    def validate_name(self, value):
        name = value.strip()
        request = self.context.get('request')
        hospital_id = getattr(self.instance, 'hospital_id', None)

        if request and request.user.is_superuser:
            hospital_id = (
                request.data.get('hospital_id')
                or request.query_params.get('hospital_id')
                or hospital_id
            )
        elif request:
            hospital_id = get_user_hospital_id(request.user)

        duplicates = Department.objects.filter(
            hospital_id=hospital_id,
            name__iexact=name,
        )
        if self.instance:
            duplicates = duplicates.exclude(pk=self.instance.pk)
        if hospital_id and duplicates.exists():
            raise serializers.ValidationError(
                'A department with this name already exists.'
            )
        return name

class DepartmentDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = '__all__'
