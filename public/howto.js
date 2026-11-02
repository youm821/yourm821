'use strict';
// Hide a screenshot slot if its picture is not there yet (drop step-1.png ... into public/howto/).
for (const i of document.querySelectorAll('.shot img')) {
  const gone = () => i.closest('.shot').remove();
  i.addEventListener('error', gone); if (i.complete && !i.naturalWidth) gone();
}