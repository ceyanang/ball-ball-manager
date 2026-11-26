import type { Injury } from '../types'
import { HERITAGES, type Heritage } from '../face/heritage'
import type { Rng } from '../rng'

const w = (s: string) => s.trim().split(/\s+/)

const BASE_FIRST = w(`
Aaron Abdul Adam Adebayo Adrian Ahmad Aidan Alec Alejandro Alex Alonzo Alvin Amari Ameer Andre Andres Andrew Angelo Anthony Antoine
Ari Armando Arturo Asher Austin Avery Bam Barry Ben Benedict Bilal Blake Bobby Boban Bojan Brad Brandon Brendan Brent Brian
Bruno Bryce Byron Caleb Calvin Cam Carlos Carmelo Carter Casey Cedric Chance Chase Chet Chris Christian Clarence Clint Cody Cole
Colin Cooper Corey Cormac Cory Craig Curtis Dabo Dalton Damian Damon Dante Darius Darnell Darren Dashawn Davion Davis Dawson Dayton
Dean Dejan Dennis Dereck Derrick Desmond Devin Dexter Diego Dimitri Domantas Dominic Donovan Dorian Drew Duane Duncan Dwayne Dylan Eddie
Edgar Elijah Elias Elliot Emeka Emmanuel Enes Enzo Eric Ernesto Ethan Evan Ezra Fabian Felix Fernando Finn Franz Fred Gabe
Garrett Gary Gavin Giannis Gideon Gordon Grady Grant Greg Hakeem Hamid Harrison Hassan Hayden Hector Henry Hugo Ian Ibrahim Ike
Isaac Isaiah Ismael Ivan Jabari Jace Jackson Jaden Jake Jalen Jamal Jamar James Jamison Jared Jarrett Jason Javier Jay Jaylen
Jeff Jerome Jesse Joaquin Joel Johan Jonah Jordan Jorge Jose Josh Josiah Juan Julian Julius Justin Kai Kamal Karl Kawhi
Keegan Keith Kelvin Kendall Kenji Kevin Khalid Kobe Kofi Kris Kristaps Kyle Lamar Lance Landon Lauri Lawrence Leo Leon Leroy
Liam Lionel Lonnie Lorenzo Luca Lucas Luis Luka Luther Malik Malcolm Manu Marcus Mario Mark Marquis Marvin Mason Mateo Matt
Maurice Max Micah Miguel Mikal Miles Milo Mitchell Moses Myles Nasir Nate Nathan Neil Nico Nikola Noah Nolan Obi Ochai
Olu Omar Oscar Otto Owen Pablo Pascal Patrick Paul Pedro Percy Peyton Quentin Quincy Rafael Rajon Ralph Ramon Rashad Ray
Reggie Remy Ricky Riley Robert Rodney Roman Ronnie Rudy Russell Ryan Sam Santiago Saul Scottie Sean Serge Seth Shai
Shane Shawn Silas Simon Spencer Stefan Sterling Steve Tariq Taylor Terrence Theo Thomas Tim Tobias Tony Torrey Trae Travis
Trevor Tristan Troy Tyler Tyrese Tyson Usman Victor Vince Wade Walker Wendell Wes Willie Xavier Yannick Yusuf Zach Zaire Zion
Ajay Bertrand Cyrus Delon Eamon Florian Gustavo Hiro Ilya Jovan Kwame Lars Marek Nikolai Oren Pavel Quinn Rasmus Sekou Tomas
Abe Achilles Adnan Aiden Akeem Alden Alistair Amir Anders Anselm Apollo Arlo Atlas Augustus Axel Barrett Beau Bennett Bijan Boone
Booker Bowie Braxton Brock Bryson Cade Callum Cassius Cayden Cesar Chandler Chidi Cillian Clay Cristian Cyril Dag Dario Deandre Declan
Deion Demarcus Denzel Dev Dmitri Dominick Dru Easton Eli Emilio Esteban Everett Farid Felipe Finley Flynn Gage Giovanni Griffin Gunnar
Hakim Hank Harlan Hendrix Idris Ishmael Jabbar Jaxon Jedidiah Jericho Jett Joaquim Jonas Jovani Judah Kaden Kareem Kaz Keanu Kellen
Kiran Knox Kobi Koa Kolby Landry Lazarus Lennox Levi Lex Lonzo Maddox Marlon Maverick Mekhi Memphis Messiah Mickey Mo Nash
Nelson Niklas Nnamdi Odell Orlando Orion Osei Otis Phoenix Pierce Prince Rafferty Rashaad Reuben Rex Rocco Roscoe Royce Rufus Sahir
Salim Santino Sergio Sky Soren Stellan Sy Tajh Tavion Teddy Thaddeus Titus Tomasz Toby Tre Ulises Valentin Vaughn Wayne Wiley
Winston Wolfgang Yosef Yuri Zane Zeke Zeus Zorion
`)

const BASE_LAST = w(`
Abara Acosta Adams Adeyemi Aguilar Alexander Allen Alvarez Anderson Andrews Armstrong Arnold Ashby Atkins Austin Bailey Baker Baldwin Banks Barnes
Barrett Bates Beasley Bell Bennett Berry Bishop Black Blake Bogdan Booker Bowen Boyd Bradley Brady Brooks Brown Bryant Burke Burton
Butler Byrd Caldwell Campbell Carroll Carter Castillo Chambers Chandler Chapman Chen Clark Clarke Cole Coleman Collins Cooper Cortez Craig Crawford
Cross Cruz Cunningham Curry Dalton Daniels Davidson Davis Dawkins Day Dean Delgado Diallo Diaz Dixon Douglas Doyle Drummond Duarte Dunn
Edwards Elliott Ellis Embry Estrada Evans Ezeli Farmer Ferguson Fernandez Fields Fischer Fleming Fletcher Flores Ford Foster Fox Francis Franklin
Freeman Fuller Gallo Garcia Gardner Garrett Gibson Gilbert Glover Gomez Gonzalez Gordon Graham Grant Graves Gray Green Griffin Gross Guerrero
Hale Hall Hamilton Hansen Hardy Harmon Harper Harris Hart Hawkins Hayes Henderson Henry Hernandez Herrera Hicks Hill Hoffman Holiday Holland
Holmes Hopkins Horton Howard Hughes Hunt Hunter Ibaka Ingram Jackson Jacobs James Jenkins Jensen Johnson Jones Jordan Joseph Kamara Keller
Kelly Kennedy Kim King Knight Koch Kovac Lambert Lane Larsen Lawrence Lawson Lee Leonard Lewis Lindqvist Little Lopez Lowe Lucas Lynch
Mack Maddox Malone Mann Marsh Martin Martinez Mason Matthews Maxwell Mayer McBride McCoy McDaniel McGee McKenzie Medina Mendez Meyer Miles
Miller Mills Mitchell Mobley Montgomery Moore Morales Moreno Morgan Morris Murphy Murray Nash Nelson Newman Nguyen Nichols Nnaji Noel Novak
Nunez Obi Odom Okafor Okeke Oliver Olsen Ortiz Osei Owens Pacheco Palmer Park Parker Patel Patterson Payne Pearson Perez Perkins Perry
Peters Petrovic Phillips Pierce Porter Powell Price Quinn Ramirez Ramos Randle Reed Reese Reeves Reid Reyes Reynolds Rhodes Rice Richards
Richardson Riley Rivera Roberts Robinson Rodgers Rodriguez Rogers Romero Rose Ross Rowe Ruiz Russell Ryan Salazar Sanchez Sanders Santos
Saric Schmidt Schroeder Scott Sexton Shaw Silva Simmons Simpson Smart Smith Snyder Soto Spencer Stanley Stewart Stokes Stone Sullivan Sutton
Swanson Tate Taylor Terry Thomas Thompson Torres Tucker Turner Ugwu Valdez Vasquez Vaughn Vega Wade Wagner Walker Wallace Walsh Walton
Ward Warren Washington Watkins Watson Weaver Webb Wells West Wheeler White Whitfield Wiggins Wilkins Williams Willis Wilson Wolfe Wood Wright Young Yurtseven Zubac
Abernathy Adewale Albright Amadi Arroyo Ashworth Baptiste Barajas Beaumont Benedetti Blackwell Bonilla Boyle Brannigan Brightman Calloway Cardenas Cashman Castellano Chaudhry
Cisneros Cobb Colbert Crowley Dagostino Dalziel Dawson Delacroix Dempsey Devereaux Dimitrov Donahue Dumont Eastwood Eberhart Egan Eze Fairbanks Falcone Farrow
Finnegan Fitzgerald Fontaine Gaines Galloway Gannon Geary Gillespie Goldberg Gutierrez Haddad Halloran Hargrove Haskins Hendricks Hightower Holloway Huang Ikeda Iverson
Jaramillo Jovanovic Kapoor Kessler Kowalski Lachance Langston Larkin Lemieux Lockhart Lombardi Madsen Maloney Marchetti Mbeki McAllister McCarthy Merrick Montague Moreau
Nakamura Navarro Nwosu Oduya Okonkwo Oyelaran Pagano Pemberton Pickett Prescott Quintero Radcliffe Rasmussen Rousseau Rutherford Saldana Sandoval Sato Scarborough Sheridan
Sinclair Solomon Stavros Strickland Tanaka Thibodeaux Tolliver Underwood Vandermeer Villanueva Voss Waddell Whitaker Winters Yamamoto Yoon Zielinski Zimmerman
`)

type Pool = { first: string[]; last: string[] }

/** Explicitly tagged non-american names. Anything in the base lists that is not tagged here is american. */
const TAGGED: Record<Exclude<Heritage, 'american'>, { first: string[]; last: string[] }> = {
  african: {
    first: w(`Adebayo Amari Emeka Kofi Kwame Chidi Nnamdi Osei Sekou Obi Olu Ochai Idris Chinedu Tunde Segun Ifeanyi Obinna Ikenna Kelechi
      Babatunde Femi Kwesi Kojo Yaw Kwabena Amadou Mamadou Moussa Ousmane Ibrahima Seydou Cheikh Jelani Zuberi Tendai Themba Sipho Thabo
      Ayodele Dayo Uche Uzoma Kamau Otieno Juma Baraka Oluwaseun Chukwudi Nkosana Lwazi Tobenna Gbenga Dapo`),
    last: w(`Abara Adeyemi Okafor Okeke Nnaji Nwosu Oduya Okonkwo Oyelaran Diallo Kamara Ugwu Ibaka Eze Amadi Ezeli Adewale Osei Mbeki Obi
      Adeleke Afolabi Akinola Balogun Chukwu Dosunmu Mensah Boateng Asante Owusu Appiah Agyemang Traore Keita Toure Coulibaly Sow Ndiaye
      Mbaye Camara Njoku Nwachukwu Onyeka Ogunleye Olawale Mwangi Kamau Otieno Ochieng Dlamini Nkosi Khumalo Adebayo Okoro Igwe Nzeogwu Bamba`),
  },
  asian: {
    first: w(`Hiro Kenji Dev Kiran Ajay Haruto Sota Ren Takumi Daiki Yuto Kaito Ryo Shin Minjun Jiho Seojun Dohyun Hyun Joon Wei Jun Lei Ming
      Hao Jian Bao Tuan Minh Duc Khoa Vikram Arjun Rohan Aarav Rahul Sanjay Amit Nikhil Rajesh Anil Raj Dhruv Ishaan Aditya Siddharth Hung
      Linh Kenta Yuki Akira Takeshi Satoshi Daichi Shota Jae Sung Tae Woo Cheng Feng Gang Tao Yuji Haru Min Jin Kazuki`),
    last: w(`Chen Kim Nguyen Park Patel Huang Ikeda Kapoor Nakamura Sato Tanaka Yamamoto Yoon Chaudhry Wang Li Zhang Liu Yang Wu Zhou Xu Sun
      Zhu Hu Guo Lin Luo Liang Song Tang Han Deng Cao Peng Zeng Xiao Tian Pan Yuan Cai Jiang Du Cheng Wei Shin Choi Jung Kang Cho Jang Lim Oh
      Seo Suzuki Takahashi Watanabe Ito Yamada Kobayashi Kato Yoshida Yamaguchi Matsumoto Inoue Kimura Hayashi Shimizu Tran Pham Hoang Dang
      Bui Ngo Singh Sharma Gupta Reddy Rao Mehta Shah Desai Joshi Iyer Nair`),
  },
  latino: {
    first: w(`Alejandro Andres Armando Arturo Cesar Cristian Diego Emilio Ernesto Esteban Felipe Fernando Gustavo Hector Ismael Javier Joaquin
      Joaquim Jorge Jose Juan Lorenzo Luis Mateo Miguel Pablo Pedro Rafael Ramon Santiago Santino Sergio Ulises Rodrigo Ricardo Eduardo Alberto
      Alfredo Gonzalo Ignacio Matias Nicolas Sebastian Agustin Facundo Leonel Marcelo Mauricio Octavio Raul Rogelio Salvador Vicente Enrique
      Francisco Guillermo Angel Cesar Julio Rolando Omar`),
    last: w(`Acosta Aguilar Alvarez Arroyo Barajas Bonilla Cardenas Castillo Cisneros Cortez Cruz Delgado Diaz Duarte Estrada Fernandez Flores
      Garcia Gomez Gonzalez Guerrero Gutierrez Hernandez Herrera Jaramillo Lopez Martinez Medina Mendez Morales Moreno Navarro Nunez Ortiz
      Pacheco Perez Quintero Ramirez Ramos Reyes Rivera Rodriguez Romero Ruiz Salazar Saldana Sanchez Sandoval Santos Silva Soto Torres Valdez
      Vasquez Vega Villanueva Aguirre Barrios Campos Cardona Contreras Dominguez Espinoza Fuentes Gallegos Ibarra Juarez Lara Luna Mejia
      Mendoza Miranda Montoya Ochoa Orozco Padilla Paredes Rojas Rios Robles Serrano Tapia Trujillo Vargas Velasquez Zamora`),
  },
  european: {
    first: w(`Boban Bojan Dejan Domantas Giannis Kristaps Luka Nikola Lauri Lars Marek Nikolai Pavel Ilya Jovan Rasmus Soren Stefan Dimitri Dmitri
      Yuri Tomasz Anders Axel Gunnar Niklas Franz Wolfgang Florian Johan Karl Ivan Serge Aleksandar Milos Nemanja Goran Zoran Vlad Andrei Matteo
      Luca Marco Stavros Nikos Kostas Dimitrios Henrik Magnus Erik Sven Dieter Klaus Lukas Jakub Piotr Radek Viktor Mirko Tibor Lazlo Gergely Mihai
      Enes Dag Aleksei Konstantin Bruno Lorcan`),
    last: w(`Bogdan Kovac Novak Petrovic Jovanovic Kowalski Larsen Lindqvist Zielinski Stavros Saric Zubac Dimitrov Fischer Koch Schmidt Schroeder
      Wagner Zimmerman Vandermeer Hansen Jensen Olsen Madsen Rasmussen Andersson Nilsson Johansson Eriksson Lindberg Bergstrom Nowak Wisniewski
      Wojcik Kaminski Horvat Babic Markovic Ilic Stojanovic Nikolic Popovic Kostic Jankovic Kuznetsov Ivanov Smirnov Popov Volkov Sokolov Lebedev
      Moreau Rousseau Dumont Fontaine Lemieux Lachance Delacroix Beaumont Devereaux Marchetti Lombardi Benedetti Pagano Falcone Dagostino
      Castellano Romano Bianchi Rossi Ricci Conti Greco Papadopoulos Georgiou Dimitriou Yurtseven Gallo Voss Kessler Eberhart`),
  },
}

const uniq = (a: string[]) => [...new Set(a)]
const taggedSet = (kind: 'first' | 'last') =>
  new Set(Object.values(TAGGED).flatMap((t) => t[kind]))

export const NAME_POOLS: Record<Heritage, Pool> = {
  american: {
    first: uniq(BASE_FIRST.filter((n) => !taggedSet('first').has(n))),
    last: uniq(BASE_LAST.filter((n) => !taggedSet('last').has(n))),
  },
  african: { first: uniq(TAGGED.african.first), last: uniq(TAGGED.african.last) },
  asian: { first: uniq(TAGGED.asian.first), last: uniq(TAGGED.asian.last) },
  latino: { first: uniq(TAGGED.latino.first), last: uniq(TAGGED.latino.last) },
  european: { first: uniq(TAGGED.european.first), last: uniq(TAGGED.european.last) },
}

export const FIRST_NAMES = uniq(HERITAGES.flatMap((h) => NAME_POOLS[h].first))
export const LAST_NAMES = uniq(HERITAGES.flatMap((h) => NAME_POOLS[h].last))

const MIXED_RATE = 0.12

/** First/last name for someone of `heritage`; ~12% mix in one part from another bucket (usually american). */
export function pickName(rng: Rng, heritage: Heritage): { firstName: string; lastName: string } {
  let firstName = rng.pick(NAME_POOLS[heritage].first)
  let lastName = rng.pick(NAME_POOLS[heritage].last)
  if (rng.chance(MIXED_RATE)) {
    const others = HERITAGES.filter((h) => h !== heritage)
    const other: Heritage = heritage !== 'american' && rng.chance(0.8) ? 'american' : rng.pick(others)
    if (rng.chance(0.5)) firstName = rng.pick(NAME_POOLS[other].first)
    else lastName = rng.pick(NAME_POOLS[other].last)
  }
  return { firstName, lastName }
}

const bucketOf = (kind: 'first' | 'last', name: string): Heritage => {
  for (const h of HERITAGES) if (h !== 'american' && NAME_POOLS[h][kind].includes(name)) return h
  return 'american'
}

/** Migration-only: surname bucket wins unless it is american, then the first name decides. */
export function heritageOfName(firstName: string, lastName: string): Heritage {
  const l = bucketOf('last', lastName)
  return l !== 'american' ? l : bucketOf('first', firstName)
}

export const HOMETOWNS = w(`
Akron Albany Albuquerque Anchorage Atlanta Austin Baltimore Baton_Rouge Birmingham Boise Buffalo Charleston Chicago Cincinnati Cleveland Columbus
Compton Dayton Denver Detroit El_Paso Fresno Gary Harlem Honolulu Houston Indianapolis Jackson Kansas_City Lagos Las_Vegas Lexington
Little_Rock Louisville Madrid Memphis Milwaukee Minneapolis Montreal Nashville Newark New_Orleans Oakland Omaha Paris Philadelphia Phoenix
Pittsburgh Portland Raleigh Richmond Rochester Sacramento Salt_Lake_City San_Diego Savannah Seattle Belgrade Spokane St._Louis Syracuse Tampa
Toronto Tucson Tulsa Vancouver Vilnius Wichita Melbourne Athens
`).map((s) => s.replace(/_/g, ' '))

export const COLLEGES = w(`
Lakeshore_State Northbridge Ridgemont Coastal_Tech Pinecrest Granite_Valley Sunvale Eastbrook Westfield_A&M Riverbend Summit_State Harbor_U
Ironwood Bluewater Maple_Hollow Cedar_Ridge Silver_Lake Oak_Grove Redstone Highland_Tech Prairie_State Golden_Plains Stonegate Clearwater
Hillcrest Brookhaven Fairview_State Kingsport Bayview Mesa_Verde Crescent_City Elmhurst Thunder_Bay_Tech Shadow_Valley Starling Northpoint
Ashford Briarwood Copperfield Driftwood Evergreen_State Foxboro Glenwood Hawthorne Ivy_Falls Juniper Knollwood Lindenwood Midland_Tech
Norwood Overbrook Parkside Quarry_Hill Rosewood Sandpoint Timberline Union_Heights Valley_Forge_Tech Willowbrook Yorkshire_State Zenith
International
`).map((s) => s.replace(/_/g, ' '))

export const INJURY_TYPES: { type: string; severity: Injury['severity'] }[] = [
  { type: 'Ankle sprain', severity: 'dtd' },
  { type: 'Sore knee', severity: 'dtd' },
  { type: 'Back spasms', severity: 'dtd' },
  { type: 'Bruised thigh', severity: 'dtd' },
  { type: 'Finger sprain', severity: 'dtd' },
  { type: 'Illness', severity: 'dtd' },
  { type: 'Hamstring strain', severity: 'short' },
  { type: 'Groin strain', severity: 'short' },
  { type: 'Sprained wrist', severity: 'short' },
  { type: 'Calf strain', severity: 'short' },
  { type: 'Concussion', severity: 'short' },
  { type: 'High ankle sprain', severity: 'long' },
  { type: 'Broken hand', severity: 'long' },
  { type: 'Torn meniscus', severity: 'long' },
  { type: 'Stress fracture (foot)', severity: 'long' },
  { type: 'Torn ACL', severity: 'season' },
  { type: 'Ruptured Achilles', severity: 'season' },
]
