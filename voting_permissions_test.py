import requests
import sys
import json
import uuid
import time
from datetime import datetime

class VotingPermissionsTest:
    def __init__(self, base_url="https://secretus-regnum.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.room_code = None  # Will create a new room
        self.players = []  # List of {id, name, seat}
        
    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}: PASSED {details}")
        else:
            print(f"❌ {name}: FAILED {details}")
        return success

    def make_request(self, method, endpoint, data=None, params=None, expected_status=200):
        """Make HTTP request with error handling"""
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
            
            if response.status_code != expected_status:
                try:
                    error_data = response.json()
                    print(f"   Error: {json.dumps(error_data, indent=2)}")
                except:
                    print(f"   Error Text: {response.text}")
                return False, {}
            
            try:
                return True, response.json()
            except:
                return True, {}
                
        except Exception as e:
            print(f"   Request failed: {str(e)}")
            return False, {}

    def setup_test_scenario(self):
        """Create a NEW test room and add exactly 5 players"""
        print(f"\n🏰 Creating NEW test room (as requested - old room may be inconsistent)")
        
        # Create a new room
        success, room_data = self.make_request('POST', 'rooms')
        if not success:
            return self.log_test("Create new room", False, "- Failed to create room")
        
        self.room_code = room_data.get('code')
        print(f"   Created new room: {self.room_code}")
        
        # Create exactly 5 players as specified in requirements
        player_names = ["Alice", "Bob", "Charlie", "Diana", "Eve"]
        
        for i, name in enumerate(player_names):
            # Create anonymous user
            user_success, user_data = self.make_request(
                'POST', 
                'auth/anonymous',
                params={"name": name}
            )
            if not user_success:
                return self.log_test("Create user", False, f"- Failed to create user {name}")
            
            player_id = user_data.get('userId')
            
            # Join room
            success, _ = self.make_request(
                'POST', 
                f'rooms/{self.room_code}/join',
                params={"player_id": player_id, "player_name": name}
            )
            if success:
                self.players.append({
                    "id": player_id, 
                    "name": name, 
                    "seat": i + 1
                })
                print(f"   Added player: {name} (seat {i+1}, ID: {player_id})")
            else:
                return self.log_test("Add players", False, f"- Failed to add {name}")
        
        return self.log_test("Setup test scenario", len(self.players) == 5, f"- {len(self.players)} players ready")

    def start_game_test(self):
        """Test starting the game"""
        print(f"\n🎮 Starting game in room {self.room_code}")
        
        success, response = self.make_request('POST', f'rooms/{self.room_code}/start')
        if not success:
            return self.log_test("Start game", False, "- Failed to start game")
        
        # Verify game state after starting
        success, game_state = self.make_request(
            'GET', 
            f'rooms/{self.room_code}/game_state',
            params={"player_id": self.players[0]['id']}  # Use first player
        )
        
        if not success:
            return self.log_test("Get game state after start", False, "- Failed to get game state")
        
        # Check if game is in NOMINATION phase with regent at seat 1
        phase = game_state.get('phase')
        regent_seat = game_state.get('regent_seat')
        
        success = (phase == 'NOMINATION' and regent_seat == 1)
        return self.log_test("Game start verification", success, 
                           f"- Phase: {phase}, Regent seat: {regent_seat}")

    def nomination_test(self):
        """Test nomination phase - regent nominates seat 2"""
        print(f"\n👑 Testing nomination phase")
        
        # Regent is seat 1 (Alice)
        regent_player = self.players[0]  # Alice, seat 1
        nominee_seat = 2  # Bob, seat 2
        
        print(f"   Regent: {regent_player['name']} (seat {regent_player['seat']}, ID: {regent_player['id']})")
        print(f"   Nominating seat: {nominee_seat}")
        
        # Regent nominates seat 2
        success, response = self.make_request(
            'POST',
            f'rooms/{self.room_code}/action',
            data={"nomineeSeat": nominee_seat},
            params={"player_id": regent_player['id'], "action_type": "NOMINATE"}
        )
        
        if not success:
            return self.log_test("Nomination action", False, "- Failed to nominate seat 2")
        
        # Wait a moment for state update
        time.sleep(0.5)
        
        # Verify game moved to VOTE phase
        success, game_state = self.make_request(
            'GET',
            f'rooms/{self.room_code}/game_state', 
            params={"player_id": regent_player['id']}
        )
        
        if not success:
            return self.log_test("Get game state after nomination", False, "- Failed to get game state")
        
        phase = game_state.get('phase')
        nominee_seat_actual = game_state.get('nominee_seat')
        
        success = (phase == 'VOTE' and nominee_seat_actual == nominee_seat)
        return self.log_test("Nomination verification", success,
                           f"- Phase: {phase}, Nominee seat: {nominee_seat_actual}")

    def voting_permissions_test(self):
        """Test the critical voting permissions bug fix"""
        print(f"\n🗳️  Testing voting permissions (CRITICAL BUG FIX)")
        
        # Get current game state to verify phase and players
        success, game_state = self.make_request(
            'GET',
            f'rooms/{self.room_code}/game_state',
            params={"player_id": self.players[0]['id']}
        )
        
        if not success:
            return self.log_test("Get game state for voting", False, "- Failed to get game state")
        
        regent_seat = game_state.get('regent_seat', 1)
        nominee_seat = game_state.get('nominee_seat', 2)
        phase = game_state.get('phase')
        
        print(f"   Current phase: {phase}")
        print(f"   Regent seat: {regent_seat}, Nominee seat: {nominee_seat}")
        
        if phase != 'VOTE':
            return self.log_test("Voting phase check", False, f"- Expected VOTE phase, got {phase}")
        
        # Test 1: Regent (seat 1) should NOT be able to vote - expect HTTP 400
        regent_player = self.players[0]  # Alice, seat 1
        print(f"   Testing regent {regent_player['name']} (seat {regent_player['seat']}) voting restriction...")
        success, response = self.make_request(
            'POST',
            f'rooms/{self.room_code}/action',
            data={"vote": "oui"},
            params={"player_id": regent_player['id'], "action_type": "VOTE"},
            expected_status=400  # Should fail with permission denied
        )
        
        regent_blocked = success  # Success means we got expected 400 error
        if regent_blocked and response.get('detail') == "Regent cannot vote":
            print(f"     ✅ Regent correctly blocked with proper error message")
        elif regent_blocked:
            print(f"     ⚠️ Regent blocked but error message different: {response.get('detail', 'No detail')}")
        else:
            print(f"     ❌ CRITICAL: Regent was allowed to vote!")
        
        self.log_test("Regent voting blocked", regent_blocked, 
                     "- Regent correctly blocked from voting" if regent_blocked else "- CRITICAL: Regent incorrectly allowed to vote")
        
        # Test 2: Nominee (seat 2) should NOT be able to vote - expect HTTP 400
        nominee_player = self.players[1]  # Bob, seat 2
        print(f"   Testing nominee {nominee_player['name']} (seat {nominee_player['seat']}) voting restriction...")
        success, response = self.make_request(
            'POST',
            f'rooms/{self.room_code}/action',
            data={"vote": "oui"},
            params={"player_id": nominee_player['id'], "action_type": "VOTE"},
            expected_status=400  # Should fail with permission denied
        )
        
        nominee_blocked = success  # Success means we got expected 400 error
        if nominee_blocked and response.get('detail') == "Nominee cannot vote":
            print(f"     ✅ Nominee correctly blocked with proper error message")
        elif nominee_blocked:
            print(f"     ⚠️ Nominee blocked but error message different: {response.get('detail', 'No detail')}")
        else:
            print(f"     ❌ CRITICAL: Nominee was allowed to vote!")
            
        self.log_test("Nominee voting blocked", nominee_blocked,
                     "- Nominee correctly blocked from voting" if nominee_blocked else "- CRITICAL: Nominee incorrectly allowed to vote")
        
        # Test 3: Eligible voters (seats 3, 4, 5) SHOULD be able to vote - expect HTTP 200
        eligible_voters = self.players[2:5]  # Charlie, Diana, Eve (seats 3, 4, 5)
        voting_allowed_count = 0
        
        for i, player in enumerate(eligible_voters):
            vote_choice = "oui" if i < 2 else "non"  # First 2 vote yes, last votes no
            print(f"   Testing eligible voter {player['name']} (seat {player['seat']}) voting '{vote_choice}'...")
            success, response = self.make_request(
                'POST',
                f'rooms/{self.room_code}/action',
                data={"vote": vote_choice},
                params={"player_id": player['id'], "action_type": "VOTE"},
                expected_status=200  # Should succeed
            )
            
            if success:
                voting_allowed_count += 1
                print(f"     ✅ {player['name']} successfully voted '{vote_choice}'")
            else:
                print(f"     ❌ CRITICAL: Eligible voter {player['name']} was blocked from voting!")
            
            # Small delay between votes
            time.sleep(0.2)
        
        other_players_can_vote = (voting_allowed_count == 3)  # All 3 should work
        self.log_test("Eligible players can vote", other_players_can_vote,
                     f"- {voting_allowed_count}/3 eligible players successfully voted")
        
        # Overall voting permissions test result
        overall_success = regent_blocked and nominee_blocked and other_players_can_vote
        return self.log_test("VOTING PERMISSIONS BUG FIX", overall_success,
                           "- All voting restrictions working correctly" if overall_success else "- CRITICAL: Voting permissions still have issues")

    def verify_vote_counting(self):
        """Verify that vote counting works correctly with only 3 eligible voters"""
        print(f"\n📊 Testing vote counting logic")
        
        # Wait a moment for vote processing
        time.sleep(1)
        
        # Get final game state to check vote results
        success, game_state = self.make_request(
            'GET',
            f'rooms/{self.room_code}/game_state',
            params={"player_id": self.players[0]['id']}
        )
        
        if not success:
            return self.log_test("Get final game state", False, "- Failed to get game state")
        
        votes = game_state.get('votes', {})
        phase = game_state.get('phase')
        
        print(f"   Votes recorded: {len(votes)}")
        print(f"   Current phase: {phase}")
        
        # Check if voting completed and moved to next phase
        # Should have moved to LEGIS_REGENT (if government elected) or NOMINATION (if rejected)
        voting_completed = phase in ['LEGIS_REGENT', 'NOMINATION']
        vote_count_correct = len(votes) == 3  # Only 3 eligible voters
        
        success = voting_completed and vote_count_correct
        
        if voting_completed:
            if phase == 'LEGIS_REGENT':
                print(f"   ✅ Government elected - moved to LEGIS_REGENT phase")
            elif phase == 'NOMINATION':
                print(f"   ✅ Government rejected - moved to next regent")
        else:
            print(f"   ❌ Voting did not complete properly - still in {phase} phase")
        
        return self.log_test("Vote counting verification", success,
                           f"- {len(votes)} votes recorded, completed: {voting_completed}, phase: {phase}")

    def run_all_tests(self):
        """Run all voting permissions tests"""
        print("🏰 SECRETUS REGNUM - VOTING PERMISSIONS BUG FIX TEST")
        print("=" * 60)
        print("TESTING REQUIREMENTS:")
        print("1. Create NEW test room (old FJRTMA may be inconsistent)")
        print("2. Add exactly 5 players and start game")
        print("3. Test nomination phase: Regent nominates seat 2")
        print("4. Test voting permissions:")
        print("   - Regent (seat 1) should get HTTP 400: 'Regent cannot vote'")
        print("   - Nominee (seat 2) should get HTTP 400: 'Nominee cannot vote'")
        print("   - Other players (seats 3,4,5) should vote successfully")
        print("5. Test vote counting: Only 3 votes needed to complete")
        print("6. Test vote progress: Shows 3 total needed, not 5")
        print("=" * 60)
        
        # Run tests in sequence
        tests = [
            ("Setup Test Scenario", self.setup_test_scenario),
            ("Start Game", self.start_game_test),
            ("Nomination Phase", self.nomination_test),
            ("Voting Permissions (CRITICAL)", self.voting_permissions_test),
            ("Vote Counting Logic", self.verify_vote_counting)
        ]
        
        all_passed = True
        for test_name, test_func in tests:
            print(f"\n{'='*20} {test_name} {'='*20}")
            try:
                result = test_func()
                if not result:
                    all_passed = False
            except Exception as e:
                print(f"❌ Test {test_name} crashed: {str(e)}")
                all_passed = False
                self.tests_run += 1
        
        # Print final results
        print(f"\n{'='*60}")
        print(f"📊 VOTING PERMISSIONS BUG FIX TEST RESULTS:")
        print(f"   Tests Run: {self.tests_run}")
        print(f"   Tests Passed: {self.tests_passed}")
        print(f"   Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"   Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%" if self.tests_run > 0 else "No tests run")
        
        if all_passed:
            print(f"\n🎉 ALL TESTS PASSED - VOTING PERMISSIONS BUG FIX VERIFIED!")
        else:
            print(f"\n⚠️  SOME TESTS FAILED - VOTING PERMISSIONS BUG STILL EXISTS!")
        
        return all_passed

def main():
    tester = VotingPermissionsTest()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())