const fs = require('fs');

const targetFiles = [
    './src/modules/ticketing/saved-replies.service.ts',
    './src/modules/zoom-booking/services/zoom-booking.service.ts'
];

function fixCreatePattern(code) {
    // We look for ".create({"
    let startIndex = 0;
    while((startIndex = code.indexOf('.create({', startIndex)) !== -1) {
        let openBraces = 0;
        let inString = false;
        let stringChar = '';
        let foundEnd = false;
        let p = startIndex + 8; // index of '{'
        
        while(p < code.length) {
            const char = code[p];
            if(!inString) {
                if(char === "'" || char === '"' || char === '`') {
                    inString = true;
                    stringChar = char;
                } else if(char === '{') {
                    openBraces++;
                } else if(char === '}') {
                    openBraces--;
                    if(openBraces === 0) {
                        foundEnd = true;
                        break;
                    }
                }
            } else {
                if(char === stringChar && code[p-1] !== '\\') {
                    inString = false;
                }
            }
            p++;
        }
        
        if(foundEnd) {
            // p is the index of '}'
            // Check if the next non-whitespace characters are ');' or ')'
            let nextP = p + 1;
            while(nextP < code.length && /\s/.test(code[nextP])) nextP++;
            if(code[nextP] === ')') {
                // insert ' as any' after '}'
                // but wait, is it already 'as any'?
                let before = code.substring(0, p + 1);
                let after = code.substring(p + 1);
                // check if after already starts with ' as'
                if(!after.trim().startsWith('as')) {
                    code = before + ' as any' + after;
                    startIndex = p + 8; // skip the added text
                    continue;
                }
            }
        }
        startIndex += 8;
    }
    return code;
}

for (const f of targetFiles) {
    if(!fs.existsSync(f)) {
        console.log('Not found:', f);
        continue;
    }

    let content = fs.readFileSync(f, 'utf8');
    let original = content;

    content = fixCreatePattern(content);

    if (content !== original) {
        fs.writeFileSync(f, content);
        console.log('Fixed repo.create:', f);
    }
}
