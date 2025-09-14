import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Vote, Crown, Users, Clock } from 'lucide-react';

export default function VotePanel({
  players = [],
  regentSeat,
  nomineeSeat,
  votes = {},
  onVote,
  myVote,
  timer,
  className = ''
}) {
  const [loading, setLoading] = useState(false);

  const regent = players.find(p => p.seat === regentSeat);
  const nominee = players.find(p => p.seat === nomineeSeat);
  
  const alivePlayers = players.filter(p => p.alive);
  const totalVotes = Object.keys(votes).length;
  const votesNeeded = alivePlayers.length;
  
  const yesVotes = Object.values(votes).filter(v => v === 'oui').length;
  const noVotes = Object.values(votes).filter(v => v === 'non').length;

  const handleVote = async (vote) => {
    if (loading || myVote) return;
    
    setLoading(true);
    try {
      await onVote(vote);
    } catch (error) {
      console.error('Error voting:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className={`bg-purple-100 border-purple-300 ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-purple-800">
          <div className="flex items-center space-x-2">
            <Vote className="h-5 w-5" />
            <span>Vote sur le Gouvernement</span>
          </div>
          {timer && (
            <Badge variant="destructive" className="flex items-center space-x-1">
              <Clock className="h-3 w-3" />
              <span>{timer}s</span>
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Government Proposal */}
        <div className="bg-white p-4 rounded-lg border border-purple-200">
          <div className="text-center space-y-2">
            <p className="text-purple-800 font-medium">Gouvernement proposé :</p>
            <div className="flex justify-center items-center space-x-8">
              <div className="text-center">
                <Crown className="h-8 w-8 text-yellow-600 mx-auto mb-1" />
                <div className="font-bold text-purple-900">RÉGENT</div>
                <div className="text-sm text-purple-700">
                  {regent?.name || `Siège ${regentSeat}`}
                </div>
              </div>
              <div className="text-2xl text-purple-400">+</div>
              <div className="text-center">
                <Users className="h-8 w-8 text-blue-600 mx-auto mb-1" />
                <div className="font-bold text-purple-900">CHAMBELLAN</div>
                <div className="text-sm text-purple-700">
                  {nominee?.name || `Siège ${nomineeSeat}`}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Vote Status */}
        <div className="bg-purple-50 p-3 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="text-purple-800 font-medium">Progression du vote :</span>
            <span className="text-purple-700">{totalVotes}/{votesNeeded}</span>
          </div>
          <div className="flex space-x-4 text-sm">
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-green-700">OUI: {yesVotes}</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-red-700">NON: {noVotes}</span>
            </div>
          </div>
        </div>

        {/* Voting Buttons */}
        {myVote ? (
          <div className="text-center p-4 bg-gray-100 rounded-lg">
            <p className="text-gray-800 font-medium">
              Vous avez voté : <strong className={myVote === 'oui' ? 'text-green-600' : 'text-red-600'}>
                {myVote === 'oui' ? 'OUI' : 'NON'}
              </strong>
            </p>
            <p className="text-gray-600 text-sm mt-1">
              En attente des autres votes...
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-purple-800 font-medium text-center">
              Votez pour ou contre ce gouvernement :
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Button
                onClick={() => handleVote('oui')}
                disabled={loading}
                className="h-16 bg-green-600 hover:bg-green-700 text-white text-lg font-bold"
              >
                <div className="text-center">
                  <div className="text-2xl mb-1">✓</div>
                  <div>OUI</div>
                </div>
              </Button>
              <Button
                onClick={() => handleVote('non')}
                disabled={loading}
                className="h-16 bg-red-600 hover:bg-red-700 text-white text-lg font-bold"
              >
                <div className="text-center">
                  <div className="text-2xl mb-1">✗</div>
                  <div>NON</div>
                </div>
              </Button>
            </div>
          </div>
        )}

        {/* Rules Reminder */}
        <div className="text-xs text-purple-600 bg-purple-50 p-3 rounded">
          <p><strong>Règle :</strong> Le gouvernement est élu si la majorité vote OUI.</p>
          <p>En cas d'échec, la crise augmente et on passe au Régent suivant.</p>
          <p>3 échecs consécutifs → Adoption automatique du prochain décret.</p>
        </div>
      </CardContent>
    </Card>
  );
}