import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';

export const MentionList = forwardRef((props: any, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const selectItem = (index: number) => {
        const item = props.items[index];
        if (item) {
            props.command({ id: item.id, label: item.fullName });
        }
    };

    const upHandler = () => {
        setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
    };

    const downHandler = () => {
        setSelectedIndex((selectedIndex + 1) % props.items.length);
    };

    const enterHandler = () => {
        selectItem(selectedIndex);
    };

    useEffect(() => setSelectedIndex(0), [props.items]);

    useImperativeHandle(ref, () => ({
        onKeyDown: ({ event }: any) => {
            if (event.key === 'ArrowUp') {
                upHandler();
                return true;
            }
            if (event.key === 'ArrowDown') {
                downHandler();
                return true;
            }
            if (event.key === 'Enter') {
                enterHandler();
                return true;
            }
            return false;
        },
    }));

    return (
        <div className="bg-navy-light border border-white/10 rounded-lg shadow-xl overflow-hidden min-w-[200px]">
            {props.items.length ? (
                props.items.map((item: any, index: number) => (
                    <button
                        key={item.id}
                        className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${index === selectedIndex ? 'bg-neon-green/20 text-white' : 'text-slate-300 hover:bg-white/5'
                            }`}
                        onClick={() => selectItem(index)}
                    >
                        <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">
                            {item.fullName.charAt(0)}
                        </div>
                        <span>{item.fullName}</span>
                    </button>
                ))
            ) : (
                <div className="px-4 py-2 text-sm text-slate-500">No result</div>
            )}
        </div>
    );
});

MentionList.displayName = 'MentionList';
