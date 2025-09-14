import requests
import sys
import json
import time
from datetime import datetime

class LegislativeCardsAPITester:
    def __init__(self, base_url="https://throne-scheme.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.room_code = None
        self.players = []  # List of {id, name, seat}
        self.regent_id = None
        self.chambellan_id = None

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
            if details:
                print(f"   {details}")
        else:
            print(f"❌ {name}")
            if details:
                print(f"   {details}")

    def make_request(self, method, endpoint, data=None, params=None, expected_status=200):
        """Make API request with error handling"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=10)
            elif method == 'POST':
                if data:
                    response = requests.post(url, json=data, headers=headers, params=params, timeout=10)
                else:
                    response = requests.post(url, headers=headers, params=params, timeout=10)
            
            print(f"   {method} {url} -> {response.status_code}")
            
            if response.status_code == expected_status:
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                try:
                    error_data = response.json()
                    print(f"   Error: {json.dumps(error_data, indent=2)}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}
                
        except Exception as e:
            print(f"   Request failed: {str(e)}")
            return False, {}

    def setup_game_with_5_players(self):
        """Create room and add 5 players to reach LEGIS_REGENT phase"""
        print("\n🏰 Setting up game with 5 players...")
        
        # Create room
        success, response = self.make_request('POST', 'rooms')
        if not success or 'code' not in response:
            self.log_test("Create Room", False, "Failed to create room")
            return False
        
        self.room_code = response['code']
        print(f"   Created room: {self.room_code}")
        
        # Create 5 players with realistic names
        player_names = ["Alice", "Bob", "Charlie", "Diana", "Eve"]
        
        for i, name in enumerate(player_names):
            # Create anonymous user
            success, user_response = self.make_request('POST', 'auth/anonymous', params={"name": name})
            if not success or 'userId' not in user_response:
                self.log_test(f"Create User {name}", False, "Failed to create user")
                return False
            
            user_id = user_response['userId']
            
            # Join room
            success, join_response = self.make_request('POST', f'rooms/{self.room_code}/join', 
                                                     params={"player_id": user_id, "player_name": name})
            if not success:
                self.log_test(f"Join Room - {name}", False, "Failed to join room")
                return False
            
            self.players.append({"id": user_id, "name": name, "seat": i + 1})
            print(f"   Added player: {name} (seat {i + 1})")
        
        self.log_test("Setup 5 Players", True, f"All 5 players added to room {self.room_code}")
        return True

    def start_game_and_reach_legis_regent(self):
        """Start game and navigate to LEGIS_REGENT phase"""
        print("\n🎮 Starting game and reaching LEGIS_REGENT phase...")
        
        # Start game
        success, response = self.make_request('POST', f'rooms/{self.room_code}/start')
        if not success:
            self.log_test("Start Game", False, "Failed to start game")
            return False
        
        print("   Game started successfully")
        
        # Get initial game state to confirm we're in NOMINATION phase
        success, state = self.make_request('GET', f'rooms/{self.room_code}/game_state', 
                                         params={"player_id": self.players[0]["id"]})
        if not success or state.get("phase") != "NOMINATION":
            self.log_test("Check Initial Phase", False, f"Expected NOMINATION, got {state.get('phase')}")
            return False
        
        regent_seat = state.get("regent_seat", 1)
        self.regent_id = next(p["id"] for p in self.players if p["seat"] == regent_seat)
        print(f"   Regent is {next(p['name'] for p in self.players if p['seat'] == regent_seat)} (seat {regent_seat})")
        
        # Regent nominates someone (let's nominate seat 2)
        nominee_seat = 2
        self.chambellan_id = next(p["id"] for p in self.players if p["seat"] == nominee_seat)
        
        success, response = self.make_request('POST', f'rooms/{self.room_code}/action',
                                            params={"player_id": self.regent_id, "action_type": "NOMINATE"},
                                            data={"nomineeSeat": nominee_seat})
        if not success:
            self.log_test("Nomination", False, "Failed to nominate")
            return False
        
        print(f"   Regent nominated {next(p['name'] for p in self.players if p['seat'] == nominee_seat)} (seat {nominee_seat})")
        
        # Check we're in VOTE phase
        success, state = self.make_request('GET', f'rooms/{self.room_code}/game_state', 
                                         params={"player_id": self.players[0]["id"]})
        if not success or state.get("phase") != "VOTE":
            self.log_test("Check Vote Phase", False, f"Expected VOTE, got {state.get('phase')}")
            return False
        
        # Have eligible players vote (seats 3, 4, 5 - excluding regent and nominee)
        eligible_voters = [p for p in self.players if p["seat"] not in [regent_seat, nominee_seat]]
        
        for voter in eligible_voters:
            success, response = self.make_request('POST', f'rooms/{self.room_code}/action',
                                                params={"player_id": voter["id"], "action_type": "VOTE"},
                                                data={"vote": "oui"})
            if not success:
                self.log_test(f"Vote - {voter['name']}", False, "Failed to vote")
                return False
            print(f"   {voter['name']} voted yes")
        
        # Check we've reached LEGIS_REGENT phase
        time.sleep(1)  # Give server time to process
        success, state = self.make_request('GET', f'rooms/{self.room_code}/game_state', 
                                         params={"player_id": self.players[0]["id"]})
        if not success or state.get("phase") != "LEGIS_REGENT":
            self.log_test("Reach LEGIS_REGENT Phase", False, f"Expected LEGIS_REGENT, got {state.get('phase')}")
            return False
        
        self.log_test("Reach LEGIS_REGENT Phase", True, "Successfully reached LEGIS_REGENT phase")
        return True

    def test_legislative_cards_visibility(self):
        """Test that regent sees cards and others don't"""
        print("\n🃏 Testing legislative cards visibility...")
        
        # Test regent can see cards
        success, regent_state = self.make_request('GET', f'rooms/{self.room_code}/game_state', 
                                                params={"player_id": self.regent_id})
        if not success:
            self.log_test("Get Regent Game State", False, "Failed to get regent state")
            return False
        
        legislative_cards = regent_state.get("legislative_cards", [])
        if len(legislative_cards) != 3:
            self.log_test("Regent Sees 3 Cards", False, f"Expected 3 cards, got {len(legislative_cards)}")
            return False
        
        print(f"   Regent sees cards: {legislative_cards}")
        self.log_test("Regent Sees 3 Cards", True, f"Regent sees {len(legislative_cards)} cards: {legislative_cards}")
        
        # Test other players can't see cards
        for player in self.players:
            if player["id"] == self.regent_id:
                continue  # Skip regent
                
            success, player_state = self.make_request('GET', f'rooms/{self.room_code}/game_state', 
                                                    params={"player_id": player["id"]})
            if not success:
                self.log_test(f"Get {player['name']} Game State", False, "Failed to get player state")
                return False
            
            player_cards = player_state.get("legislative_cards", [])
            if len(player_cards) != 0:
                self.log_test(f"{player['name']} Sees No Cards", False, f"Expected 0 cards, got {len(player_cards)}")
                return False
            
            print(f"   {player['name']} sees no cards ✓")
        
        self.log_test("Other Players See No Cards", True, "All non-regent players see empty legislative_cards array")
        return True

    def test_regent_discard_action(self):
        """Test regent can discard a card and move to LEGIS_CHAMBELLAN"""
        print("\n🗑️ Testing regent DISCARD action...")
        
        # Regent discards first card (index 0)
        success, response = self.make_request('POST', f'rooms/{self.room_code}/action',
                                            params={"player_id": self.regent_id, "action_type": "DISCARD"},
                                            data={"cardId": 0})
        if not success:
            self.log_test("Regent Discard Action", False, "Failed to discard card")
            return False
        
        print("   Regent successfully discarded card")
        
        # Check we moved to LEGIS_CHAMBELLAN phase
        time.sleep(1)
        success, state = self.make_request('GET', f'rooms/{self.room_code}/game_state', 
                                         params={"player_id": self.players[0]["id"]})
        if not success or state.get("phase") != "LEGIS_CHAMBELLAN":
            self.log_test("Move to LEGIS_CHAMBELLAN", False, f"Expected LEGIS_CHAMBELLAN, got {state.get('phase')}")
            return False
        
        # Check chambellan can see remaining 2 cards
        success, chambellan_state = self.make_request('GET', f'rooms/{self.room_code}/game_state', 
                                                    params={"player_id": self.chambellan_id})
        if not success:
            self.log_test("Get Chambellan State", False, "Failed to get chambellan state")
            return False
        
        chambellan_cards = chambellan_state.get("legislative_cards", [])
        if len(chambellan_cards) != 2:
            self.log_test("Chambellan Sees 2 Cards", False, f"Expected 2 cards, got {len(chambellan_cards)}")
            return False
        
        print(f"   Chambellan sees remaining cards: {chambellan_cards}")
        self.log_test("Regent Discard Success", True, "Regent discarded card, moved to LEGIS_CHAMBELLAN, chambellan sees 2 cards")
        return True

    def test_chambellan_adopt_action(self):
        """Test chambellan can adopt a card and update tracks"""
        print("\n📜 Testing chambellan DISCARD (adopt) action...")
        
        # Get current tracks before adoption
        success, pre_state = self.make_request('GET', f'rooms/{self.room_code}/game_state', 
                                             params={"player_id": self.players[0]["id"]})
        if not success:
            self.log_test("Get Pre-Adoption State", False, "Failed to get state")
            return False
        
        pre_tracks = pre_state.get("tracks", {})
        print(f"   Tracks before adoption: {pre_tracks}")
        
        # Get the cards chambellan can see
        success, chambellan_state = self.make_request('GET', f'rooms/{self.room_code}/game_state', 
                                                    params={"player_id": self.chambellan_id})
        if not success:
            self.log_test("Get Chambellan Cards", False, "Failed to get chambellan state")
            return False
        
        chambellan_cards = chambellan_state.get("legislative_cards", [])
        if len(chambellan_cards) != 2:
            self.log_test("Verify Chambellan Cards", False, f"Expected 2 cards, got {len(chambellan_cards)}")
            return False
        
        # Chambellan adopts first card (index 0)
        card_to_adopt = chambellan_cards[0]
        success, response = self.make_request('POST', f'rooms/{self.room_code}/action',
                                            params={"player_id": self.chambellan_id, "action_type": "DISCARD"},
                                            data={"cardId": 0})
        if not success:
            self.log_test("Chambellan Adopt Action", False, "Failed to adopt card")
            return False
        
        print(f"   Chambellan adopted card: {card_to_adopt}")
        
        # Check tracks were updated correctly
        time.sleep(1)
        success, post_state = self.make_request('GET', f'rooms/{self.room_code}/game_state', 
                                              params={"player_id": self.players[0]["id"]})
        if not success:
            self.log_test("Get Post-Adoption State", False, "Failed to get state")
            return False
        
        post_tracks = post_state.get("tracks", {})
        print(f"   Tracks after adoption: {post_tracks}")
        
        # Verify track was updated based on adopted card
        if card_to_adopt == "LOYAL":
            expected_loyal = pre_tracks.get("loyal", 0) + 1
            if post_tracks.get("loyal", 0) != expected_loyal:
                self.log_test("Track Update - LOYAL", False, f"Expected loyal={expected_loyal}, got {post_tracks.get('loyal', 0)}")
                return False
        elif card_to_adopt == "CONJURE":
            expected_conjure = pre_tracks.get("conjure", 0) + 1
            if post_tracks.get("conjure", 0) != expected_conjure:
                self.log_test("Track Update - CONJURE", False, f"Expected conjure={expected_conjure}, got {post_tracks.get('conjure', 0)}")
                return False
        
        # Check phase transition (should move to NOMINATION or POWER depending on tracks)
        new_phase = post_state.get("phase")
        if new_phase not in ["NOMINATION", "POWER"]:
            self.log_test("Phase Transition", False, f"Expected NOMINATION or POWER, got {new_phase}")
            return False
        
        # Check legislative_cards is cleared
        success, final_state = self.make_request('GET', f'rooms/{self.room_code}/game_state', 
                                               params={"player_id": self.chambellan_id})
        if success:
            final_cards = final_state.get("legislative_cards", [])
            if len(final_cards) != 0:
                self.log_test("Legislative Cards Cleared", False, f"Expected 0 cards, got {len(final_cards)}")
                return False
        
        self.log_test("Chambellan Adopt Success", True, f"Adopted {card_to_adopt}, tracks updated, moved to {new_phase}")
        return True

    def test_invalid_actions(self):
        """Test that invalid actions are properly rejected"""
        print("\n🚫 Testing invalid actions...")
        
        # Try to have non-regent player discard during LEGIS_REGENT (if we're still in that phase)
        # First, let's create a fresh game to test this properly
        if not self.setup_game_with_5_players():
            return False
        if not self.start_game_and_reach_legis_regent():
            return False
        
        # Try non-regent player discarding
        non_regent = next(p for p in self.players if p["id"] != self.regent_id)
        success, response = self.make_request('POST', f'rooms/{self.room_code}/action',
                                            params={"player_id": non_regent["id"], "action_type": "DISCARD"},
                                            data={"cardId": 0},
                                            expected_status=400)
        if not success:
            self.log_test("Non-Regent Discard Blocked", False, "Should have blocked non-regent discard")
            return False
        
        # Try invalid card index
        success, response = self.make_request('POST', f'rooms/{self.room_code}/action',
                                            params={"player_id": self.regent_id, "action_type": "DISCARD"},
                                            data={"cardId": 99},
                                            expected_status=400)
        if not success:
            self.log_test("Invalid Card Index Blocked", False, "Should have blocked invalid card index")
            return False
        
        self.log_test("Invalid Actions Blocked", True, "All invalid actions properly rejected")
        return True

    def run_all_tests(self):
        """Run the complete test suite"""
        print("🏰 Starting Legislative Cards API Tests")
        print("=" * 60)
        
        # Test sequence
        tests = [
            ("Setup Game with 5 Players", self.setup_game_with_5_players),
            ("Reach LEGIS_REGENT Phase", self.start_game_and_reach_legis_regent),
            ("Test Legislative Cards Visibility", self.test_legislative_cards_visibility),
            ("Test Regent Discard Action", self.test_regent_discard_action),
            ("Test Chambellan Adopt Action", self.test_chambellan_adopt_action),
            ("Test Invalid Actions", self.test_invalid_actions),
        ]
        
        for test_name, test_func in tests:
            print(f"\n{'='*20} {test_name} {'='*20}")
            try:
                success = test_func()
                if not success:
                    print(f"❌ {test_name} failed - stopping test suite")
                    break
            except Exception as e:
                print(f"❌ {test_name} crashed: {str(e)}")
                break
        
        # Print final results
        print(f"\n{'='*60}")
        print(f"📊 Final Results:")
        print(f"   Tests Run: {self.tests_run}")
        print(f"   Tests Passed: {self.tests_passed}")
        print(f"   Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"   Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%" if self.tests_run > 0 else "No tests run")
        
        if self.room_code:
            print(f"\n🏰 Test Room: {self.room_code}")
            print(f"👥 Players: {[p['name'] for p in self.players]}")
        
        return self.tests_passed == self.tests_run

def main():
    tester = LegislativeCardsAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())