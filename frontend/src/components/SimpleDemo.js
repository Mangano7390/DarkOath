import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

const SimpleDemo = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-900 via-amber-800 to-orange-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl bg-amber-50/95 backdrop-blur-sm border-amber-200 shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl text-amber-900 font-serif text-center">
            Secretus Regnum - Demo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center p-6">
            <p className="text-amber-800 text-lg mb-4">
              Demo page for Secretus Regnum
            </p>
            <p className="text-amber-600">
              This is a placeholder demo component.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SimpleDemo;