import wordsList from './_word_list';

const generateWordsList = count => {
  const pickedWords = [];
  for (let x = 0; x < count; x++) {
    pickedWords.push(wordsList[Math.floor(Math.random() * wordsList.length)]);
  }
  return pickedWords.join(' ');
};

// The following is the code which will generate a list of 12 random words that will be
// used to generate an nxt account
export const generate_passphrase = () => generateWordsList(12);
// The following is the code which will generate a list of 4 random words
// that will be used to generate an api key
export const generate_keywords = () => generateWordsList(4);
