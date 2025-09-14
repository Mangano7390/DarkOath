import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Crown, Users } from 'lucide-react';

export default function NominationPanel({
  meSeat,
  regentSeat,
  players = [],
  prevGovernment,
  onNominate,
  className = ''
}) {
  const [loading, setLoading] = useState(false);

  // Si je ne suis pas le Régent, j'attends
  if (meSeat !== regentSeat) {
    const regent = players.find(p => p.seat === regentSeat);
    return (
      <Card className={`bg-amber-100 border-amber-300 ${className}`}>
        <CardContent className="p-6 text-center">
          <Crown className="h-12 w-12 text-amber-600 mx-auto mb-4" />
          <p className="text-amber-800 text-lg">
            En attente que <strong>{regent?.name || `Siège ${regentSeat}`}</strong> nomme un Chambellan...
          </p>
          <p className="text-amber-600 text-sm mt-2">
            Le Régent doit choisir qui sera son second pour gouverner.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Filtre des candidats éligibles
  const inPrevGov = (seat) => {
    if (!prevGovernment) return false;
    return prevGovernment.regent === seat || prevGovernment.chambellan === seat;
  };

  const candidates = players.filter(p => 
    p.alive && 
    p.seat !== regentSeat && 
    !inPrevGov(p.seat)
  );

  const handleNominate = async (seat) => {
    if (loading) return;
    
    setLoading(true);
    try {
      await onNominate(seat);
    } catch (error) {
      console.error('Error nominating:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className={`bg-blue-100 border-blue-300 ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-blue-800">
          <Crown className="h-5 w-5" />
          <span>Nomination du Chambellan</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-blue-800 font-medium">
          En tant que <strong>Régent</strong>, choisissez votre <strong>Chambellan</strong> :
        </p>
        
        {candidates.length > 0 ? (
          <div className="grid grid-cols-1 gap-2">
            {candidates.map((player) => (
              <Button
                key={player.seat}
                onClick={() => handleNominate(player.seat)}
                disabled={loading}
                variant="outline"
                className="justify-start h-12 bg-white hover:bg-blue-50 border-blue-300 hover:border-blue-400"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center text-sm font-bold">
                    {player.seat}
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-blue-900">{player.name}</div>
                    <div className="text-xs text-blue-600">Siège {player.seat}</div>
                  </div>
                </div>
              </Button>
            ))}
          </div>
        ) : (
          <div className="text-center p-4 bg-red-100 rounded-lg border border-red-300">
            <p className="text-red-800 font-medium">
              ⚠️ Aucun candidat éligible
            </p>
            <p className="text-red-600 text-sm mt-1">
              (Vérifiez les règles d'éligibilité - gouvernement précédent exclu)
            </p>
            {prevGovernment && (
              <p className="text-red-500 text-xs mt-2">
                Gouvernement précédent : Régent {prevGovernment.regent}, Chambellan {prevGovernment.chambellan}
              </p>
            )}
          </div>
        )}
        
        <div className="text-xs text-blue-600 bg-blue-50 p-3 rounded">
          <p><strong>Règle :</strong> Le Chambellan ne peut pas être :</p>
          <p>• Le Régent actuel (vous)</p>
          <p>• Un membre du gouvernement précédent</p>
          <p>• Un joueur éliminé</p>
        </div>
      </CardContent>
    </Card>
  );
}