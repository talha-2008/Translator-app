const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const resultsArea = document.getElementById('results-area');
const wordTitle = document.getElementById('word-title');
const phonetic = document.getElementById('phonetic');
const meaningsDiv = document.getElementById('meanings');
const errorMessage = document.getElementById('error-message');

const DICTIONARY_API_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en';

async function searchWord() {
    const word = searchInput.value.trim().toLowerCase();
    if (!word) {
        errorMessage.textContent = 'অনুসন্ধানের জন্য একটি শব্দ লিখুন।';
        resultsArea.style.display = 'none';
        return;
    }
    
    errorMessage.textContent = '';
    resultsArea.style.display = 'none';
    wordTitle.textContent = '';
    phonetic.textContent = '';
    meaningsDiv.innerHTML = '';
    
    try {
        const response = await fetch(`${DICTIONARY_API_URL}/${word}`);
        const data = await response.json();

        if (response.ok) {
            displayResults(data[0]);
            resultsArea.style.display = 'block';
        } else {
            errorMessage.textContent = 'দুঃখিত, এই শব্দের কোনো ফলাফল পাওয়া যায়নি।';
        }
    } catch (error) {
        console.error('Error:', error);
        errorMessage.textContent = 'সার্ভারের সাথে সংযোগে সমস্যা হয়েছে।';
    }
}

function displayResults(data) {
    wordTitle.textContent = data.word;
    
    if (data.phonetic) {
        phonetic.textContent = data.phonetic;
    }

    data.meanings.forEach(meaning => {
        const meaningCard = document.createElement('div');
        meaningCard.classList.add('meaning-card');

        const partOfSpeech = document.createElement('h4');
        partOfSpeech.textContent = meaning.partOfSpeech;
        meaningCard.appendChild(partOfSpeech);

        meaning.definitions.forEach(def => {
            const definition = document.createElement('p');
            definition.textContent = def.definition;
            meaningCard.appendChild(definition);
            
            if (def.example) {
                const example = document.createElement('p');
                example.innerHTML = `<i class="fas fa-quote-left"></i> ${def.example} <i class="fas fa-quote-right"></i>`;
                example.style.fontStyle = 'italic';
                example.style.color = '#555';
                meaningCard.appendChild(example);
            }
        });
        meaningsDiv.appendChild(meaningCard);
    });
}

searchBtn.addEventListener('click', searchWord);
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        searchWord();
    }
});