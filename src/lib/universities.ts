/**
 * UK universities, for suggestions while typing. Picking from the list also
 * keeps the demographic data tidy ("UCL", "University College London" and
 * "ucl london" all become one name). Anything not listed can still be typed.
 * [name, ...short names people use]
 */
const LIST: [string, ...string[]][] = [
  ['Abertay University'],
  ['Aberystwyth University', 'Aber'],
  ['Anglia Ruskin University', 'ARU'],
  ['Arden University'],
  ['Arts University Bournemouth', 'AUB'],
  ['Aston University'],
  ['Bangor University'],
  ['Bath Spa University'],
  ['Birkbeck, University of London'],
  ['Birmingham City University', 'BCU'],
  ['Bishop Grosseteste University'],
  ['Bournemouth University'],
  ['BPP University'],
  ['Brunel University London'],
  ['Buckinghamshire New University', 'Bucks'],
  ['Canterbury Christ Church University', 'CCCU'],
  ['Cardiff Metropolitan University', 'Cardiff Met'],
  ['Cardiff University'],
  ["City St George's, University of London", 'City', "St George's"],
  ['Coventry University'],
  ['Cranfield University'],
  ['De Montfort University', 'DMU'],
  ['Durham University'],
  ['Edge Hill University'],
  ['Edinburgh Napier University', 'Napier'],
  ['Falmouth University'],
  ['Glasgow Caledonian University', 'GCU'],
  ['Goldsmiths, University of London'],
  ['Harper Adams University'],
  ['Hartpury University'],
  ['Heriot-Watt University'],
  ['Imperial College London', 'Imperial'],
  ['Keele University'],
  ["King's College London", 'KCL', 'Kings'],
  ['Kingston University'],
  ['Lancaster University'],
  ['Leeds Arts University'],
  ['Leeds Beckett University', 'Beckett'],
  ['Leeds Trinity University'],
  ['Liverpool Hope University'],
  ['Liverpool John Moores University', 'LJMU'],
  ['London Metropolitan University', 'London Met'],
  ['London School of Economics and Political Science', 'LSE'],
  ['London South Bank University', 'LSBU'],
  ['Loughborough University', 'Lboro'],
  ['Manchester Metropolitan University', 'MMU', 'Man Met'],
  ['Middlesex University'],
  ['Newcastle University'],
  ['Northeastern University London'],
  ['Northumbria University'],
  ['Norwich University of the Arts'],
  ['Nottingham Trent University', 'NTU'],
  ['Oxford Brookes University', 'Brookes'],
  ['Plymouth Marjon University'],
  ['Queen Margaret University'],
  ['Queen Mary University of London', 'QMUL'],
  ["Queen's University Belfast", 'QUB'],
  ['Ravensbourne University London'],
  ["Regent's University London"],
  ['Robert Gordon University', 'RGU'],
  ['Royal Agricultural University'],
  ['Royal College of Art', 'RCA'],
  ['Royal Holloway, University of London', 'RHUL'],
  ['Royal Veterinary College', 'RVC'],
  ['Sheffield Hallam University', 'Hallam'],
  ['SOAS University of London'],
  ['Solent University'],
  ["St Mary's University, Twickenham"],
  ['Staffordshire University'],
  ['Swansea University'],
  ['Teesside University'],
  ['The Open University', 'OU'],
  ['Ulster University'],
  ['University College Birmingham'],
  ['University College London', 'UCL'],
  ['University for the Creative Arts', 'UCA'],
  ['University of Aberdeen'],
  ['University of Bath'],
  ['University of Bedfordshire'],
  ['University of Birmingham', 'UoB'],
  ['University of Bolton'],
  ['University of Bradford'],
  ['University of Brighton'],
  ['University of Bristol'],
  ['University of Buckingham'],
  ['University of Cambridge', 'Cambridge'],
  ['University of Central Lancashire', 'UCLan'],
  ['University of Chester'],
  ['University of Chichester'],
  ['University of Cumbria'],
  ['University of Derby'],
  ['University of Dundee'],
  ['University of East Anglia', 'UEA'],
  ['University of East London', 'UEL'],
  ['University of Edinburgh'],
  ['University of Essex'],
  ['University of Exeter'],
  ['University of Glasgow'],
  ['University of Gloucestershire'],
  ['University of Greenwich'],
  ['University of Hertfordshire', 'Herts'],
  ['University of Huddersfield'],
  ['University of Hull'],
  ['University of Kent'],
  ['University of Law'],
  ['University of Leeds'],
  ['University of Leicester'],
  ['University of Lincoln'],
  ['University of Liverpool'],
  ['University of Manchester', 'UoM'],
  ['University of Northampton'],
  ['University of Nottingham', 'UoN'],
  ['University of Oxford', 'Oxford'],
  ['University of Plymouth'],
  ['University of Portsmouth'],
  ['University of Reading'],
  ['University of Roehampton'],
  ['University of Salford'],
  ['University of Sheffield'],
  ['University of South Wales', 'USW'],
  ['University of Southampton', 'Soton'],
  ['University of St Andrews', 'St Andrews'],
  ['University of Stirling'],
  ['University of Strathclyde', 'Strath'],
  ['University of Suffolk'],
  ['University of Sunderland'],
  ['University of Surrey'],
  ['University of Sussex'],
  ['University of the Arts London', 'UAL'],
  ['University of the Highlands and Islands', 'UHI'],
  ['University of the West of England', 'UWE'],
  ['University of the West of Scotland', 'UWS'],
  ['University of Wales Trinity Saint David', 'UWTSD'],
  ['University of Warwick', 'Warwick'],
  ['University of West London', 'UWL'],
  ['University of Westminster'],
  ['University of Winchester'],
  ['University of Wolverhampton'],
  ['University of Worcester'],
  ['University of York'],
  ['Wrexham University'],
  ['York St John University'],
];

export const UNIVERSITIES = LIST.map(([name]) => name);

const norm = (s: string) =>
  s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

// Words that don't help tell universities apart.
const FILLER = new Set(['university', 'of', 'the', 'college', 'london']);

/** Best matches for what's been typed so far, best first. */
export function searchUniversities(query: string, max = 6): string[] {
  const q = norm(query);
  if (q.length < 2) return [];
  const scored: { name: string; score: number }[] = [];
  for (const [name, ...aliases] of LIST) {
    const n = norm(name);
    const words = n.split(' ');
    const keyWords = words.filter((w) => !FILLER.has(w));
    let score = 0;
    if (n === q) score = 100;
    else if (aliases.some((a) => norm(a) === q)) score = 95;
    else if (keyWords.some((w) => w.startsWith(q))) score = 80; // "leed" -> University of Leeds
    else if (n.startsWith(q)) score = 70;
    else if (aliases.some((a) => norm(a).startsWith(q))) score = 60;
    else if (q.split(' ').every((part) => words.some((w) => w.startsWith(part)))) score = 50; // "uni of lee"
    else if (n.includes(q)) score = 30;
    if (score) scored.push({ name, score: score - n.length / 1000 }); // shorter names first on ties
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, max).map((s) => s.name);
}
