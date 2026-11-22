import type { Injury } from '../types'

const w = (s: string) => s.trim().split(/\s+/)

export const FIRST_NAMES = w(`
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
`)

export const LAST_NAMES = w(`
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
`)

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
