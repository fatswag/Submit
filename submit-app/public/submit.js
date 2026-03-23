// load joke types into the dropdown when the page opens
async function loadTypes() {
  const select = document.getElementById('typeSelect');

  try {
    const res = await fetch('/types');
    const types = await res.json();

    // keep the default option first
    select.innerHTML = '<option value="">-- Select a type --</option>';

    types.forEach(type => {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type;
      select.appendChild(option);
    });

  } catch (err) {
    console.error(err);
    document.getElementById('result').innerHTML = '<p>Could not load joke types</p>';
  }
}

// handle form submit
document.getElementById('submitForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const selectedType = document.getElementById('typeSelect').value.trim();
  const newType = document.getElementById('newType').value.trim();
  const setup = document.getElementById('setup').value.trim();
  const punchline = document.getElementById('punchline').value.trim();
  const resultDiv = document.getElementById('result');

  // use the new type if they entered one, otherwise use dropdown
  const type = newType || selectedType;

  // quick front-end check
  if (!type || !setup || !punchline) {
    resultDiv.innerHTML = '<p>Please fill everything in</p>';
    return;
  }

  try {
    const res = await fetch('/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, setup, punchline })
    });

    const data = await res.json();

    if (!res.ok) {
      resultDiv.innerHTML = `<p>${data.message}</p>`;
      return;
    }

    resultDiv.innerHTML = `<p>${data.message}</p>`;
    document.getElementById('submitForm').reset();

    // reload types in case a new one was added
    loadTypes();

  } catch (err) {
    console.error(err);
    resultDiv.innerHTML = '<p>Could not submit</p>';
  }
});

// run this when the page loads
loadTypes();