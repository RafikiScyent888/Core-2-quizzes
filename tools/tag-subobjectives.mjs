// Re-tags QUESTION_BANK entries in ../index.html with a fine-grained
// sub-objective (in addition to the existing broad `domain`).
// Informal study-aid taxonomy inspired by the public CompTIA A+ Core 2
// (220-1202) domain structure; not official CompTIA material.
//
// Run with: node tools/tag-subobjectives.mjs

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FILE = path.join(ROOT, "index.html");

export const SUB_OBJECTIVES = {
  "Operating Systems": [
    { id: "1.1", label: "OS Types & Purposes" },
    { id: "1.2", label: "Windows Installation & Upgrades" },
    { id: "1.3", label: "Windows Editions & Features" },
    { id: "1.4", label: "Windows System Tools & Utilities" },
    { id: "1.5", label: "Windows Networking & Settings" },
    { id: "1.6", label: "macOS & Linux Tools" },
  ],
  "Security": [
    { id: "2.1", label: "Physical Security & Concepts" },
    { id: "2.2", label: "Wireless & Network Security" },
    { id: "2.3", label: "Malware Types & Removal" },
    { id: "2.4", label: "Social Engineering & Threats" },
    { id: "2.5", label: "Windows Security Settings" },
    { id: "2.6", label: "Mobile & Embedded Device Security" },
    { id: "2.7", label: "Data Destruction & Disposal" },
    { id: "2.8", label: "SOHO Security Configuration" },
  ],
  "Software Troubleshooting": [
    { id: "3.1", label: "Windows OS Troubleshooting" },
    { id: "3.2", label: "PC Security & Malware Removal" },
    { id: "3.3", label: "Mobile OS & App Troubleshooting" },
    { id: "3.4", label: "Mobile Security Troubleshooting" },
  ],
  "Operational Procedures": [
    { id: "4.1", label: "Documentation & Ticketing" },
    { id: "4.2", label: "Change Management" },
    { id: "4.3", label: "Backup & Recovery Methods" },
    { id: "4.4", label: "Safety & Environmental Controls" },
    { id: "4.5", label: "Privacy, Licensing & Policy" },
    { id: "4.6", label: "Communication & Professionalism" },
    { id: "4.7", label: "Scripting Basics" },
    { id: "4.8", label: "Remote Access Technologies" },
  ],
};

const RULES = {
  "Operating Systems": [
    ["1.6", /\b(mac ?os|finder|terminal\b|apt\b|yum\b|brew\b|linux|chmod|chown|sudo|grep\b|ls -|package manager)\b/i],
    ["1.5", /\b(control panel|windows settings|network(ing)? config|ip settings|firewall setting|proxy setting|homegroup|workgroup|domain join)\b/i],
    ["1.4", /\b(task manager|device manager|disk management|event viewer|msconfig|regedit|services\.msc|msc snap-in|system tools|performance monitor|computer management)\b/i],
    ["1.3", /\b(windows (home|pro|enterprise|education)|windows edition|feature comparison|s mode)\b/i],
    ["1.2", /\b(install(ation)?|upgrade path|clean install|in-place upgrade|partition|file system|ntfs|fat32|exfat|unattended install|image deployment)\b/i],
    ["1.1", /.*/],
  ],
  "Security": [
    ["2.8", /\b(soho|router (security|config)|default password change|firmware update|content filtering|home network security)\b/i],
    ["2.7", /\b(data destruction|degauss|drive wipe|low-level format|physical destruction|recycl(e|ing)|disposal)\b/i],
    ["2.6", /\b(mobile device (security|management)|mdm\b|remote wipe|screen lock|biometric|full device encryption on mobile)\b/i],
    ["2.5", /\b(bitlocker|windows firewall|user account control|uac\b|local security policy|user (account|group)|ntfs permission|share permission|encrypting file system|efs\b)\b/i],
    ["2.4", /\b(phishing|social engineering|shoulder surf|tailgating|dumpster diving|impersonation|whaling|vishing|pretexting)\b/i],
    ["2.3", /\b(malware|virus|ransomware|trojan|spyware|rootkit|keylogger|worm\b|antivirus|anti-malware|remediation)\b/i],
    ["2.2", /\b(wpa|wireless security|wep\b|network security protocol|802\.1x|radius|vpn\b|firewall\b|port security)\b/i],
    ["2.1", /.*/],
  ],
  "Software Troubleshooting": [
    ["3.4", /\b(mobile.{0,20}(security|malware)|leaked personal files|unauthorized (account|root|location) access|high (network|resource) usage on mobile)\b/i],
    ["3.3", /\b(mobile (os|app)|smartphone|tablet).{0,40}(troubleshoot|crash|freeze|slow|won'?t|not responding|fails to)/i],
    ["3.2", /\b(malware symptom|removal (steps|process)|quarantine|rogue antivirus|browser redirect|pop-?up|hijacked)\b/i],
    ["3.1", /.*/],
  ],
  "Operational Procedures": [
    ["4.8", /\b(remote (access|desktop)|rdp\b|vnc\b|ssh\b|remote monitoring and management|rmm\b|third-party remote)\b/i],
    ["4.7", /\b(script|\.bat\b|\.ps1\b|\.sh\b|\.py\b|batch file|powershell|environment variable|scripting)\b/i],
    ["4.6", /\b(communication|professionalism|active listening|avoid jargon|difficult customer|do not argue)\b/i],
    ["4.5", /\b(privacy|license|eula\b|dmca|pii\b|phi\b|gdpr|chain of custody|regulated data|incident response documentation)\b/i],
    ["4.4", /\b(safety|electrostatic discharge|esd\b|msds|sds\b|fire (safety|extinguisher)|toxic waste|proper lifting|electrical safety|ups\b|surge protector)\b/i],
    ["4.3", /\b(backup|restore point|system restore|recovery (image|method)|grandfather.father.son|backup rotation|onsite backup|offsite backup)\b/i],
    ["4.2", /\b(change (management|request)|rollback plan|risk analysis|end-user acceptance|approval process|scope of change)\b/i],
    ["4.1", /.*/],
  ],
};

function classify(q) {
  const rules = RULES[q.domain];
  const haystack = `${q.q} ${q.choices.join(" ")} ${q.explain || ""}`;
  for (const [id, re] of rules) {
    if (re.test(haystack)) return id;
  }
  return rules[rules.length - 1][0];
}

function main() {
  const text = readFileSync(FILE, "utf8");
  const startTag = '<script id="question-data" type="application/json">';
  const start = text.indexOf(startTag);
  const jsonStart = start + startTag.length;
  const jsonEnd = text.indexOf("</script>", jsonStart);
  const bank = JSON.parse(text.slice(jsonStart, jsonEnd));

  const counts = {};
  bank.forEach((q) => {
    q.sub = classify(q);
    counts[q.sub] = (counts[q.sub] || 0) + 1;
  });

  console.log(`Tagged ${bank.length} questions.`);
  for (const [domain, subs] of Object.entries(SUB_OBJECTIVES)) {
    console.log(domain);
    subs.forEach((s) => console.log(`  ${s.id} ${s.label.padEnd(40)} ${counts[s.id] || 0}`));
  }

  const newJson = JSON.stringify(bank);
  const newText = text.slice(0, jsonStart) + newJson + text.slice(jsonEnd);
  writeFileSync(FILE, newText);
  console.log("\nWrote updated index.html");
}

main();
