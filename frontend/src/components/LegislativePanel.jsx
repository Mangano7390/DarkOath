import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Gavel, Crown, Users } from 'lucide-react';

export default function LegislativePanel({
  phase, // 'LEGIS_REGENT' or 'LEGIS_CHAMBELLAN'
  mySeat,
  regentSeat,
  chambellanSeat,
  players = [],
  cards = [], // [{ type: 'loyal'|'conjure', id: string }, ...]
  onDiscard,
  className = ''
}) {
  const [selectedCard, setSelectedCard] = useState(null);
  const [loading, setLoading] = useState(false);

  const isRegentTurn = phase === 'LEGIS_REGENT';
  const isChambellanTurn = phase === 'LEGIS_CHAMBELLAN';
  
  const regent = players.find(p => p.seat === regentSeat);
  const chambellan = players.find(p => p.seat === chambellanSeat);
  
  const isMyTurn = (isRegentTurn && mySeat === regentSeat) || 
                   (isChambellanTurn && mySeat === chambellanSeat);
  
  const currentPlayer = isRegentTurn ? regent : chambellan;
  const cardsToShow = cards.length;
  const action = isRegentTurn ? 'défausser 1 carte' : 'défausser 1 carte et adopter 1';

  const handleDiscard = async () => {
    if (!selectedCard || loading) return;
    
    setLoading(true);
    try {
      await onDiscard(selectedCard);
      setSelectedCard(null);
    } catch (error) {
      console.error('Error discarding card:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCardColor = (type) => {
    return type === 'loyal' 
      ? { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-800' }
      : { bg: 'bg-red-100', border: 'border-red-300', text: 'text-red-800' };
  };

  if (!isMyTurn) {
    return (
      <Card className={`bg-amber-100 border-amber-300 ${className}`}>
        <CardContent className="p-6 text-center">
          <Gavel className="h-12 w-12 text-amber-600 mx-auto mb-4" />
          <p className="text-amber-800 text-lg">
            <strong>{currentPlayer?.name || `Siège ${isRegentTurn ? regentSeat : chambellanSeat}`}</strong> 
            {' '}est en session législative...
          </p>
          <p className="text-amber-600 text-sm mt-2">
            {isRegentTurn 
              ? 'Le Régent pioche 3 décrets et en défausse 1'
              : 'Le Chambellan choisit quel décret adopter'
            }
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`bg-green-100 border-green-300 ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-green-800">
          <Gavel className="h-5 w-5" />
          <span>Session Législative</span>
          {isRegentTurn && <Crown className="h-4 w-4 text-yellow-600" />}
          {isChambellanTurn && <Users className="h-4 w-4 text-blue-600" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <p className="text-green-800 font-medium">
            Vous devez <strong>{action}</strong>
          </p>
          {isRegentTurn && (
            <p className="text-green-600 text-sm mt-1">
              Vous transmettrez les 2 cartes restantes au Chambellan
            </p>
          )}
        </div>

        {/* Cards Display */}
        <div className="space-y-3">
          <p className="font-medium text-green-800">
            Décrets piochés ({cardsToShow} cartes) :
          </p>
          
          {cards.length > 0 ? (
            <div className="grid grid-cols-1 gap-2">
              {cards.map((card, index) => {
                const colors = getCardColor(card.type);
                const isSelected = selectedCard === card.id;
                
                return (
                  <button
                    key={card.id || index}
                    onClick={() => setSelectedCard(card.id)}
                    className={`p-4 rounded-lg border-2 transition-all ${colors.bg} ${
                      isSelected 
                        ? 'border-green-500 shadow-lg transform scale-105' 
                        : `${colors.border} hover:border-green-400`
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-full ${colors.bg} flex items-center justify-center`}>
                          {card.type === 'loyal' ? '🛡' : '🗡'}
                        </div>
                        <div className="text-left">
                          <div className={`font-bold ${colors.text}`}>
                            DÉCRET {card.type === 'loyal' ? 'LOYAL' : 'CONJURÉ'}
                          </div>
                          <div className={`text-xs ${colors.text} opacity-75`}>
                            {card.type === 'loyal' ? 'Ordre et Stabilité' : 'Chaos et Révolution'}
                          </div>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="text-green-600 font-bold">
                          ✓ SÉLECTIONNÉE
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center p-4 bg-gray-100 rounded-lg">
              <p className="text-gray-600">Aucune carte disponible</p>
            </div>
          )}
        </div>

        {/* Action Button */}
        <Button
          onClick={handleDiscard}
          disabled={!selectedCard || loading || cards.length === 0}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3"
        >
          {loading ? 'En cours...' : 
           isRegentTurn ? 'Défausser cette carte' : 'Adopter cette carte'}
        </Button>

        {/* Rules Reminder */}
        <div className="text-xs text-green-600 bg-green-50 p-3 rounded">
          {isRegentTurn ? (
            <p><strong>Régent :</strong> Défaussez 1 carte face cachée, transmettez 2 cartes au Chambellan.</p>
          ) : (
            <p><strong>Chambellan :</strong> Défaussez 1 carte face cachée, adoptez 1 carte (visible sur la piste).</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}