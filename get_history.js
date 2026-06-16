const fs = require('fs');
const readline = require('readline');
const path = require('path');

const logPath = "C:/Users/ssheo/.gemini/antigravity/brain/b89f2579-b9e0-4767-b9bb-021561566a2d/.system_generated/logs/transcript_full.jsonl";

const fileStream = fs.createReadStream(logPath, 'utf8');
const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
});

let index = 0;
rl.on('line', (line) => {
    index++;
    if (line.toLowerCase().includes('student_dashboard') && (line.includes('replace_file_content') || line.includes('write_to_file') || line.includes('multi_replace_file_content'))) {
        try {
            const obj = JSON.parse(line);
            const toolCalls = obj.tool_calls || [];
            toolCalls.forEach((tc) => {
                const args = tc.args || {};
                const targetFile = args.TargetFile || '';
                if (targetFile.toLowerCase().includes('student_dashboard')) {
                    console.log(`--- MATCH AT LINE ${index} ---`);
                    console.log("Tool Name:", tc.name);
                    console.log("Instruction:", args.Instruction);
                    console.log("Description:", args.Description);
                }
            });
        } catch (e) {
            // ignore
        }
    }
});

rl.on('close', () => {
    console.log("Done.");
});
