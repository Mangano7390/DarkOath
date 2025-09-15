import requests
import sys
import json
from datetime import datetime

class SecretusRegnumAPITester:
    def __init__(self, base_url="https://secretus-regnum.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.room_code = None
        self.user_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=10)
            elif method == 'POST':
                if data:
                    response = requests.post(url, json=data, headers=headers, params=params, timeout=10)
                else:
                    response = requests.post(url, headers=headers, params=params, timeout=10)

            print(f"   Status Code: {response.status_code}")
            
            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)}")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error Response: {json.dumps(error_data, indent=2)}")
                except:
                    print(f"   Error Text: {response.text}")
                return False, {}

        except requests.exceptions.Timeout:
            print(f"❌ Failed - Request timed out")
            return False, {}
        except requests.exceptions.ConnectionError:
            print(f"❌ Failed - Connection error")
            return False, {}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test the root API endpoint"""
        success, response = self.run_test(
            "Root API Endpoint",
            "GET",
            "",
            200
        )
        return success

    def test_create_anonymous_user(self, name="TestPlayer"):
        """Test creating an anonymous user"""
        success, response = self.run_test(
            "Create Anonymous User",
            "POST",
            "auth/anonymous",
            200,
            params={"name": name}
        )
        if success and 'userId' in response:
            self.user_id = response['userId']
            print(f"   Created user ID: {self.user_id}")
            return True
        return False

    def test_create_room(self):
        """Test creating a room"""
        success, response = self.run_test(
            "Create Room",
            "POST",
            "rooms",
            200
        )
        if success and 'code' in response:
            self.room_code = response['code']
            print(f"   Created room code: {self.room_code}")
            return True
        return False

    def test_get_room(self):
        """Test getting room information"""
        if not self.room_code:
            print("❌ Cannot test get room - no room code available")
            return False
            
        success, response = self.run_test(
            "Get Room Information",
            "GET",
            f"rooms/{self.room_code}",
            200
        )
        return success

    def test_join_room(self):
        """Test joining a room"""
        if not self.room_code or not self.user_id:
            print("❌ Cannot test join room - missing room code or user ID")
            return False
            
        success, response = self.run_test(
            "Join Room",
            "POST",
            f"rooms/{self.room_code}/join",
            200,
            params={"player_id": self.user_id, "player_name": "TestPlayer"}
        )
        return success

    def test_start_game(self):
        """Test starting a game (should fail with insufficient players)"""
        if not self.room_code:
            print("❌ Cannot test start game - no room code available")
            return False
            
        success, response = self.run_test(
            "Start Game (Expected to Fail - Not Enough Players)",
            "POST",
            f"rooms/{self.room_code}/start",
            400  # Should fail with 400 because we need 5 players
        )
        return success

    def test_nonexistent_room(self):
        """Test getting a non-existent room"""
        success, response = self.run_test(
            "Get Non-existent Room",
            "GET",
            "rooms/NONEXISTENT",
            404
        )
        return success

def main():
    print("🏰 Starting Secretus Regnum API Tests")
    print("=" * 50)
    
    # Setup
    tester = SecretusRegnumAPITester()
    
    # Run tests in sequence
    tests = [
        ("Root Endpoint", tester.test_root_endpoint),
        ("Create Anonymous User", tester.test_create_anonymous_user),
        ("Create Room", tester.test_create_room),
        ("Get Room", tester.test_get_room),
        ("Join Room", tester.test_join_room),
        ("Start Game (Insufficient Players)", tester.test_start_game),
        ("Non-existent Room", tester.test_nonexistent_room),
    ]
    
    for test_name, test_func in tests:
        print(f"\n{'='*20} {test_name} {'='*20}")
        try:
            test_func()
        except Exception as e:
            print(f"❌ Test {test_name} crashed: {str(e)}")
    
    # Print final results
    print(f"\n{'='*50}")
    print(f"📊 Final Results:")
    print(f"   Tests Run: {tester.tests_run}")
    print(f"   Tests Passed: {tester.tests_passed}")
    print(f"   Tests Failed: {tester.tests_run - tester.tests_passed}")
    print(f"   Success Rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%" if tester.tests_run > 0 else "No tests run")
    
    if tester.room_code:
        print(f"\n🏰 Test Room Created: {tester.room_code}")
        print(f"👤 Test User ID: {tester.user_id}")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())