const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, "teacher_dashboard (1).html");
let content = fs.readFileSync(targetFile, 'utf8').replace(/\r\n/g, '\n');

// All recovered JSON files in chronological order
const filesToApply = [
    "recovered_edit_2393.json",
    "recovered_edit_2399.json",
    "recovered_edit_2409.json",
    "recovered_edit_2419.json",
    "recovered_edit_2443.json",
    "recovered_edit_2447.json",
    "recovered_edit_2501.json",
    "recovered_edit_2507.json",
    "recovered_edit_2570.json",
    "recovered_edit_2574.json",
    "recovered_edit_2647.json",
    "recovered_edit_2657.json",
    "recovered_edit_2661.json",
    "recovered_edit_2714.json",
    "recovered_edit_2730.json",
    "recovered_edit_2742.json",
    "recovered_edit_2752.json",
    "recovered_edit_2756.json",
    "recovered_edit_2772.json",
    "recovered_edit_2776.json",
    "recovered_edit_2786.json",
    "recovered_edit_2792.json",
    "recovered_edit_2794.json",
    "recovered_edit_2804.json",
    "recovered_edit_2825.json"
];

filesToApply.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) {
        console.log(`Skipping non-existent file: ${file}`);
        return;
    }
    
    console.log(`Applying ${file}...`);
    const edit = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    if (edit.ReplacementChunks) {
        edit.ReplacementChunks.forEach((chunk, idx) => {
            const target = chunk.TargetContent.replace(/\r\n/g, '\n');
            const replacement = chunk.ReplacementContent.replace(/\r\n/g, '\n');
            
            if (content.includes(target)) {
                content = content.replace(target, replacement);
                console.log(`  - Chunk ${idx} replaced successfully.`);
            } else {
                console.error(`  - ERROR: Chunk ${idx} TargetContent not found!`);
            }
        });
    } else {
        const target = edit.TargetContent.replace(/\r\n/g, '\n');
        const replacement = edit.ReplacementContent.replace(/\r\n/g, '\n');
        
        if (content.includes(target)) {
            content = content.replace(target, replacement);
            console.log(`  - Replaced successfully.`);
        } else {
            console.error(`  - ERROR: TargetContent not found!`);
        }
    }
});

// Convert back to CRLF for Windows compatibility
fs.writeFileSync(targetFile, content.replace(/\n/g, '\r\n'), 'utf8');
console.log("Completed applying recovered edits.");
