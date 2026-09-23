const fs = require('fs');
let shm = fs.readFileSync('src/features/plan/SetHotelModal.tsx', 'utf8');
shm = shm.replace("    draftHotels[1] != null && ", "    // draftHotels[1] != null && ");
shm = shm.replace("    Array.from({ length: totalDays }).every((_, i) => JSON.stringify(draftHotels[i + 1]) === JSON.stringify(draftHotels[1]));", "    // Array.from({ length: totalDays }).every((_, i) => JSON.stringify(draftHotels[i + 1]) === JSON.stringify(draftHotels[1]));");
fs.writeFileSync('src/features/plan/SetHotelModal.tsx', shm);
