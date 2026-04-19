import requests
import sys
import json
from datetime import datetime
import time

class ChatSystemTester:
    def __init__(self, base_url="https://deduction-game-3.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.room_code = "RZFTLE"  # Using existing room with 5 players
        
        # Player data from the existing room RZFTLE
        self.players = [
            {"name": "Alice", "id": None},
            {"name": "Bob", "id": None}, 
            {"name": "Charlie", "id": None},
            {"name": "Diana", "id": None},
            {"name": "Eve", "id": None}
        ]

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        if params:
            print(f"   Params: {params}")
        
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

    def setup_players(self):
        """Create player IDs for testing"""
        print(f"\n{'='*20} Setting Up Players {'='*20}")
        
        for i, player in enumerate(self.players):
            success, response = self.run_test(
                f"Create Player {player['name']}",
                "POST",
                "auth/anonymous",
                200,
                params={"name": player['name']}
            )
            if success and 'userId' in response:
                self.players[i]['id'] = response['userId']
                print(f"   Created {player['name']} with ID: {response['userId']}")
            else:
                print(f"❌ Failed to create player {player['name']}")
                return False
        return True

    def test_room_exists(self):
        """Test that the RZFTLE room exists"""
        success, response = self.run_test(
            f"Check Room {self.room_code} Exists",
            "GET",
            f"rooms/{self.room_code}",
            200
        )
        if success:
            print(f"   Room {self.room_code} exists with {len(response.get('players', []))} players")
        return success

    def test_send_chat_message(self, player_index, message):
        """Test sending a chat message"""
        if player_index >= len(self.players) or not self.players[player_index]['id']:
            print(f"❌ Invalid player index {player_index} or missing player ID")
            return False
            
        player = self.players[player_index]
        success, response = self.run_test(
            f"Send Chat Message from {player['name']}",
            "POST",
            f"rooms/{self.room_code}/chat",
            200,
            params={
                "player_id": player['id'],
                "message": message
            }
        )
        return success

    def test_get_chat_history(self, player_index):
        """Test getting chat history"""
        if player_index >= len(self.players) or not self.players[player_index]['id']:
            print(f"❌ Invalid player index {player_index} or missing player ID")
            return False
            
        player = self.players[player_index]
        success, response = self.run_test(
            f"Get Chat History for {player['name']}",
            "GET",
            f"rooms/{self.room_code}/chat",
            200,
            params={"player_id": player['id']}
        )
        return success, response

    def test_chat_with_invalid_player(self):
        """Test sending chat with invalid player ID"""
        success, response = self.run_test(
            "Send Chat with Invalid Player ID",
            "POST",
            f"rooms/{self.room_code}/chat",
            404,  # Should return 404 for invalid player
            params={
                "player_id": "invalid-player-id",
                "message": "This should fail"
            }
        )
        return success

    def test_chat_with_invalid_room(self):
        """Test sending chat to invalid room"""
        if not self.players[0]['id']:
            print("❌ No player ID available for invalid room test")
            return False
            
        success, response = self.run_test(
            "Send Chat to Invalid Room",
            "POST",
            "rooms/INVALID/chat",
            404,  # Should return 404 for invalid room
            params={
                "player_id": self.players[0]['id'],
                "message": "This should fail"
            }
        )
        return success

    def simulate_conversation(self):
        """Simulate a multi-player conversation"""
        print(f"\n{'='*20} Simulating Conversation {'='*20}")
        
        conversation = [
            (0, "Salutations, mes amis! Comment allez-vous?"),  # Alice
            (1, "Bien, merci Alice! Prêt pour cette partie?"),   # Bob
            (2, "Oui, j'ai hâte de commencer!"),                # Charlie
            (3, "Que la meilleure stratégie gagne!"),           # Diana
            (4, "Bonne chance à tous!"),                        # Eve
            (0, "Merci Eve! Que le jeu commence!"),             # Alice again
        ]
        
        all_success = True
        for player_index, message in conversation:
            success = self.test_send_chat_message(player_index, message)
            if not success:
                all_success = False
            time.sleep(0.5)  # Small delay between messages
            
        return all_success

    def run_comprehensive_chat_tests(self):
        """Run all chat-related tests"""
        print("💬 Starting Comprehensive Chat System Tests")
        print("=" * 60)
        
        # Test 1: Setup players
        if not self.setup_players():
            print("❌ Failed to setup players - aborting tests")
            return False
            
        # Test 2: Verify room exists
        if not self.test_room_exists():
            print("❌ Room RZFTLE does not exist - aborting tests")
            return False
            
        # Test 3: Test basic chat functionality
        print(f"\n{'='*20} Basic Chat Tests {'='*20}")
        self.test_send_chat_message(0, "Test message from Alice")
        self.test_get_chat_history(0)
        
        # Test 4: Test error conditions
        print(f"\n{'='*20} Error Condition Tests {'='*20}")
        self.test_chat_with_invalid_player()
        self.test_chat_with_invalid_room()
        
        # Test 5: Simulate conversation
        self.simulate_conversation()
        
        # Test 6: Final chat history check
        print(f"\n{'='*20} Final Chat History Check {'='*20}")
        success, response = self.test_get_chat_history(0)
        if success:
            messages = response.get('messages', [])
            print(f"   Total messages in history: {len(messages)}")
            for msg in messages:
                print(f"   - {msg.get('player_name', 'Unknown')}: {msg.get('message', '')}")
        
        return True

def main():
    print("💬 Starting Chat System Tests for Room RZFTLE")
    print("=" * 60)
    
    # Setup
    tester = ChatSystemTester()
    
    # Run comprehensive tests
    try:
        tester.run_comprehensive_chat_tests()
    except Exception as e:
        print(f"❌ Test suite crashed: {str(e)}")
    
    # Print final results
    print(f"\n{'='*60}")
    print(f"📊 Final Chat Test Results:")
    print(f"   Tests Run: {tester.tests_run}")
    print(f"   Tests Passed: {tester.tests_passed}")
    print(f"   Tests Failed: {tester.tests_run - tester.tests_passed}")
    print(f"   Success Rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%" if tester.tests_run > 0 else "No tests run")
    
    print(f"\n🏰 Test Room: {tester.room_code}")
    print(f"👥 Players tested: {', '.join([p['name'] for p in tester.players])}")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())