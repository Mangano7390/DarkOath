import React from 'react';

export default function SimpleDemo() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-900 via-amber-800 to-orange-900 p-6">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-5xl font-bold text-amber-100 mb-8">
          🏰 Secretus Regnum
        </h1>
        <p className="text-2xl text-amber-200 mb-12">
          Composants de jeu avec SVG inline - Version de démonstration
        </p>
        
        {/* Simple SVG Board */}
        <div className="bg-amber-50 rounded-2xl p-8 mb-8 shadow-2xl">
          <h2 className="text-3xl font-bold text-amber-900 mb-6">Plateau de Jeu</h2>
          <svg width="800" height="400" viewBox="0 0 800 400" className="w-full">
            <defs>
              <linearGradient id="parchment" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F3E9D2" />
                <stop offset="100%" stopColor="#E6D3B2" />
              </linearGradient>
            </defs>
            
            {/* Background */}
            <rect width="800" height="400" fill="url(#parchment)" rx="20" />
            
            {/* Title */}
            <text x="400" y="50" textAnchor="middle" fontSize="24" fontWeight="bold" fill="#30343A">
              SECRETUS REGNUM
            </text>
            
            {/* Loyal Track */}
            <text x="150" y="120" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#1E3A5F">
              DÉCRETS LOYAUX
            </text>
            {[1,2,3,4,5].map(i => (
              <g key={i}>
                <circle 
                  cx={50 + i * 50} 
                  cy={150} 
                  r="20" 
                  fill={i <= 2 ? "#1E3A5F" : "transparent"}
                  stroke="#1E3A5F" 
                  strokeWidth="3"
                  strokeDasharray={i <= 2 ? "0" : "6 4"}
                />
                <text x={50 + i * 50} y={155} textAnchor="middle" fontSize="12" fill={i <= 2 ? "#F3E9D2" : "#1E3A5F"}>
                  {i}
                </text>
              </g>
            ))}
            
            {/* Conjure Track */}
            <text x="500" y="120" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#5B1F2A">
              DÉCRETS CONJURÉS
            </text>
            {[1,2,3,4,5,6].map(i => (
              <g key={i}>
                <circle 
                  cx={350 + i * 50} 
                  cy={150} 
                  r="20" 
                  fill={i <= 3 ? "#5B1F2A" : "transparent"}
                  stroke="#5B1F2A" 
                  strokeWidth="3"
                  strokeDasharray={i <= 3 ? "0" : "6 4"}
                />
                <text x={350 + i * 50} y={155} textAnchor="middle" fontSize="12" fill={i <= 3 ? "#F3E9D2" : "#5B1F2A"}>
                  {i}
                </text>
                
                {/* Power icons */}
                {i === 2 && (
                  <g>
                    <circle cx={350 + i * 50} cy={200} r="15" fill="#1E3A5F" />
                    <text x={350 + i * 50} y={206} textAnchor="middle" fontSize="18" fill="#F3E9D2">👁</text>
                  </g>
                )}
                {i === 4 && (
                  <g>
                    <circle cx={350 + i * 50} cy={200} r="15" fill="#C0392B" />
                    <text x={350 + i * 50} y={206} textAnchor="middle" fontSize="18" fill="#F3E9D2">⚔</text>
                  </g>
                )}
              </g>
            ))}
            
            {/* Crisis Track */}
            <text x="400" y="280" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#D35400">
              PISTE DE CRISE
            </text>
            {[0,1,2,3].map(i => (
              <g key={i}>
                <circle 
                  cx={300 + i * 50} 
                  cy={320} 
                  r="18" 
                  fill={i <= 1 ? "#D35400" : "#D35400"}
                  opacity={i <= 1 ? "1" : "0.3"}
                />
                <text x={300 + i * 50} y={326} textAnchor="middle" fontSize="14" fontWeight="bold" fill="#F7F3EA">
                  {i}
                </text>
              </g>
            ))}
          </svg>
        </div>
        
        {/* Simple Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Decree Loyal */}
          <div className="bg-blue-100 rounded-xl p-6 shadow-lg">
            <svg width="200" height="280" viewBox="0 0 200 280" className="w-full">
              <rect width="200" height="280" fill="#F3E9D2" rx="12" />
              <circle cx="100" cy="100" r="30" fill="#1E3A5F" />
              <text x="100" y="107" textAnchor="middle" fontSize="24" fill="#F3E9D2">🛡</text>
              <text x="100" y="180" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#30343A">
                DÉCRET LOYAL
              </text>
            </svg>
          </div>
          
          {/* Decree Conjure */}
          <div className="bg-red-100 rounded-xl p-6 shadow-lg">
            <svg width="200" height="280" viewBox="0 0 200 280" className="w-full">
              <rect width="200" height="280" fill="#E6D3B2" rx="12" />
              <circle cx="100" cy="100" r="30" fill="#5B1F2A" />
              <text x="100" y="107" textAnchor="middle" fontSize="24" fill="#E6D3B2">🗡</text>
              <text x="100" y="180" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#30343A">
                DÉCRET CONJURÉ
              </text>
            </svg>
          </div>
          
          {/* Role Card */}
          <div className="bg-purple-100 rounded-xl p-6 shadow-lg">
            <svg width="200" height="280" viewBox="0 0 200 280" className="w-full">
              <rect width="200" height="280" fill="#F3E9D2" rx="12" />
              <circle cx="100" cy="100" r="30" fill="#4A148C" />
              <text x="100" y="107" textAnchor="middle" fontSize="24" fill="#F7F3EA">👑</text>
              <text x="100" y="180" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#30343A">
                USURPATEUR
              </text>
              <text x="100" y="200" textAnchor="middle" fontSize="12" fill="#30343A">
                Vous êtes l'Usurpateur
              </text>
            </svg>
          </div>
        </div>
        
        {/* Vote Tokens */}
        <div className="flex justify-center space-x-8 mb-8">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-green-600 flex items-center justify-center shadow-lg mb-2">
              <span className="text-white text-2xl font-bold">✓</span>
            </div>
            <p className="text-amber-200">OUI</p>
          </div>
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center shadow-lg mb-2">
              <span className="text-white text-2xl font-bold">✗</span>
            </div>
            <p className="text-amber-200">NON</p>
          </div>
        </div>
        
        {/* Government Placards */}
        <div className="grid grid-cols-2 gap-8">
          <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-lg p-4 shadow-lg">
            <div className="flex items-center justify-center space-x-4">
              <span className="text-3xl">👑</span>
              <div className="text-yellow-900">
                <div className="font-bold text-lg">RÉGENT</div>
                <div className="text-sm">Chef du Gouvernement</div>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-r from-yellow-500 to-yellow-700 rounded-lg p-4 shadow-lg">
            <div className="flex items-center justify-center space-x-4">
              <span className="text-3xl">🔑</span>
              <div className="text-yellow-900">
                <div className="font-bold text-lg">CHAMBELLAN</div>
                <div className="text-sm">Second du Gouvernement</div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-12 p-6 bg-amber-100 rounded-lg">
          <p className="text-amber-800 text-lg">
            🎨 Tous ces éléments utilisent uniquement du SVG inline et des classes Tailwind CSS
          </p>
          <p className="text-amber-700 text-sm mt-2">
            Aucune image externe requise - Prêt pour l'intégration !
          </p>
        </div>
      </div>
    </div>
  );
}