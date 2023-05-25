import Search from './classes/search.js'
import fs from 'fs'
import mysql from 'mysql'
import util from 'util'
const config = JSON.parse(fs.readFileSync('db_config.json'))
const fb_user = JSON.parse(fs.readFileSync('fb_config.json'))
const search = new Search(5, fb_user.user, fb_user.password)

const db = mysql.createConnection(config);

export default async function Scraper() {
  db.connect()
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

