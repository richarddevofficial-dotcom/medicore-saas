from django.test import SimpleTestCase


class HealthCheckTests(SimpleTestCase):
    def test_health_check_is_public(self):
        response = self.client.get('/api/v1/health/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'ok'})
