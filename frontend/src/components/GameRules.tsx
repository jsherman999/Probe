import { useState } from 'react';
import Button from '../components/Button';
import Modal from '../components/Modal';
import Card from '../components/Card';

const GameRules = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" onClick={() => setIsOpen(true)} aria-label="View game rules">
        How to Play
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="How to Play Probe"
      >
        <div className="space-y-4">
          <Card>
            <h3 className="text-lg font-bold text-accent mb-2">📝 Setup</h3>
            <ul className="space-y-2 text-gray-300">
              <li>• 2-4 players join the same game room</li>
              <li>• Each player secretly selects a word (4-12 letters)</li>
              <li>• Game begins when all players have chosen their words</li>
            </ul>
          </Card>

          <Card>
            <h3 className="text-lg font-bold text-accent mb-2">🎯 Gameplay</h3>
            <ul className="space-y-2 text-gray-300">
              <li>• Players take turns guessing letters in opponents' words</li>
              <li>• Choose a letter and select which player to probe</li>
              <li>• If the letter is in their word, one instance is revealed</li>
              <li>• Earn points based on the position of the revealed letter</li>
              <li>• Can guess the full word for a large bonus</li>
            </ul>
          </Card>

          <Card>
            <h3 className="text-lg font-bold text-accent mb-2">⭐ Scoring</h3>
            <ul className="space-y-2 text-gray-300 text-sm">
              <li>• <strong>Position-based:</strong> Points are awarded by letter position (5, 10, 15, repeating)</li>
              <li>• <strong>Position 0, 3, 6...</strong> = 5 points each</li>
              <li>• <strong>Position 1, 4, 7...</strong> = 10 points each</li>
              <li>• <strong>Position 2, 5, 8...</strong> = 15 points each</li>
              <li>• <strong>Word guess bonus:</strong> Base 50-100 pts + value of all unrevealed positions (including blanks)</li>
              <li>• <strong>Wrong word guess:</strong> -50 points</li>
            </ul>
          </Card>

          <Card>
            <h3 className="text-lg font-bold text-accent mb-2">🏆 Winning</h3>
            <ul className="space-y-2 text-gray-300">
              <li>• Continue your turn if you guess correctly</li>
              <li>• Turn passes to next player on incorrect guess</li>
              <li>• When your word is completely revealed, you're eliminated</li>
              <li>• Last player remaining wins!</li>
              <li>• Highest score wins if all words are revealed</li>
            </ul>
          </Card>

          <Card>
            <h3 className="text-lg font-bold text-accent mb-2">💡 Strategy Tips</h3>
            <ul className="space-y-2 text-gray-300">
              <li>• Start with common letters (E, A, R, S, T)</li>
              <li>• Target players with longer words for more points</li>
              <li>• Save high-value letters for when you have clues</li>
              <li>• Choose obscure words to avoid early elimination</li>
            </ul>
          </Card>
        </div>
      </Modal>
    </>
  );
};

export default GameRules;
