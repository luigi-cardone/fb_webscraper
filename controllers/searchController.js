import Search from './classes/search.js'
import mysql from 'mysql'
import util from 'util'
import dotenv from 'dotenv'
dotenv.config()
const search = new Search(5, process.env.FACEBOOK_EMAIL, process.env.FACEBOOK_PASSWORD)
const db = mysql.createConnection({
  host : process.env.DB_HOST,
  user : process.env.DB_USER,
  password : process.env.DB_PASSWORD,
  database : process.env.DB_NAME
});

export default async function Scraper() {
  try{
    db.connect()
  }
  catch (err){
    console.log(err)
    return 0
  }
  const query = util.promisify(db.query).bind(db)
  const duplicates = await query('SELECT `urn` FROM `cars_facebook` WHERE 1')
  console.log("Got the following duplicates number: " + duplicates.length)
  const data = await search.main(duplicates)
  var failures = 0
  for (let car of data) {
    const geo_info = await query('SELECT * FROM `italy_munic` WHERE `comune` = ?', [car.geo_town])
    try {
      await query('INSERT INTO `cars_facebook`(`urn`, `subject`, `price`, `mileage_scalar`, `register_year`, `geo_region`, `geo_provincia`, `geo_town`, `url`, `advertiser_name`, `advertiser_phone`) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        [car.urn, car.subject, car.price, car.mileage_scalar, car.register_year, car.geo_region, geo_info[0].provincia, car.geo_town, car.url, car.advertiser_name, car.advertiser_phone])
      console.log(`Element ${car.subject} added to database`)
    }
    catch (err) {
      console.log("Unable to add current item")
      failures++
    }

  }
  console.log(`${data.length - failures} out of ${data.length} were added successfully to the database`)
  try {
    await query('DELETE FROM `cars_facebook` WHERE `date_remote` > ?', [new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000)])
    console.log("Database was updated successfully")
  }
  catch (err) {
    console.log(err)
  }
}

