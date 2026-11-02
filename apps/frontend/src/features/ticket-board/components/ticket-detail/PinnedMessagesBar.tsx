import React, { useEffect, useState } from 'react';
import { Pin, PinOff } from 'lucide-react';
import { quoteKind, toDisplayName } from './messageThread';

export interface PinnedBarItem {
    id: string;
    senderName: string;
    snippet: string;
}

interface PinnedMessagesBarProps {
    /** Oldest first, as the server lists them. */
    pins: PinnedBarItem[];
    onJump: (messageId: string) => void;
    onUnpin?: (messageId: string) => void;
}

const preview = (text: string) => {
    const kind = quoteKind(text);
    return kind === 'photo' ? 'Foto' : kind === 'file' ? 'File' : text;
};

/**
 * WhatsApp-style pinned strip above the chat: shows the newest pin; each click jumps to the shown
 * message and steps back to the previous pin, wrapping around (with a "n dari total" counter).
 */
export const PinnedMessagesBar: React.FC<PinnedMessagesBarProps> = ({ pins, onJump, onUnpin }) => {
    const [index, setIndex] = useState(pins.length - 1);
    useEffect(() => setIndex(pins.length - 1), [pins.length]);
    if (pins.length === 0) return null;

    const current = pins[Math.min(Math.max(index, 0), pins.length - 1)];
    const position = pins.indexOf(current) + 1;
    const handleClick = () => {
        onJump(current.id);
        setIndex((i) => (i <= 0 ? pins.length - 1 : i - 1));
    };

    return (
        <div className="chat-pins" data-pinned-messages>
            <button
                type="button"
                className="chat-pins-main"
                onClick={handleClick}
                aria-label={`Pesan disematkan ${position} dari ${pins.length}`}
            >
                {pins.length > 1 && (
                    <span className="chat-pins-rail" aria-hidden="true">
                        {pins.map((p) => <i key={p.id} className={p.id === current.id ? 'is-on' : undefined} />)}
                    </span>
                )}
                <Pin aria-hidden="true" className="chat-pins-icon" />
                <span className="chat-pins-text">
                    <b>{toDisplayName(current.senderName)}</b>
                    <span>{preview(current.snippet)}</span>
                </span>
            </button>
            {onUnpin && (
                <button type="button" className="chat-pins-x" aria-label="Lepas sematan" title="Lepas sematan" onClick={() => onUnpin(current.id)}>
                    <PinOff aria-hidden="true" />
                </button>
            )}
        </div>
    );
};
