const view = new URLSearchParams(location.search).get('view');
if (['jerry', 'enemies', 'weapons'].includes(view)) {
  import('./viewer.js');
} else {
  import('./main.js');
}
