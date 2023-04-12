import fsPromises from 'fs/promises'
import puppeteer from 'puppeteer'
import JSON2CSVParser from 'json2csv/lib/JSON2CSVParser.js'
export default class Search{

    constructor(scrollCount, email, password){
        this.scrollCount = scrollCount
        this.email = email
        this.password = password
    }
    
    main = async (duplicates) => {
        console.log(puppeteer.executablePath())
        this.browser = await puppeteer.launch({executablePath: "chrome-win/chrome.exe"});
        this.page = await this.browser.newPage();
        const page = this.page
        const context = this.browser.defaultBrowserContext();
        context.overridePermissions("https://www.facebook.com", ["geolocation", "notifications"]);
        await page.setViewport({ width: 1200, height: 800 });
        // bypass facebook login
        await page.goto('https://www.facebook.com/marketplace/category/vehicles', { waitUntil: 'networkidle2' });
        console.log("Authentication in progress...")
        const cookieButton = await page.$x('/html/body/div[3]/div[2]/div/div/div/div/div[3]/button[1]')
        cookieButton[0].click()
        // wait for Facebook login form
        await page.waitForSelector('#email');
        // click Accept cookies button if it exist
        await page.evaluate(() =>document.querySelector('button[type="Submit"]')&&[...document.querySelectorAll('button[type="Submit"]')].at(-1).click());
        // fill in and submit the form
        await page.evaluate((val) => email.value = val, this.email);
        await page.evaluate((val) => pass.value = val, this.password);
        await page.evaluate(selector => document.querySelector(selector).click(), 'input[value="Log In"],#loginbutton');
        console.log('Login completed')
        await page.waitForNavigation({waitUntil: 'networkidle2'});
        console.log('Page downloaded')
      
        // Analizziamo ogni annuncio
        await page.waitForXPath('//div[@aria-label="Raccolta di articoli di Marketplace"]')
        const card_div_path = '/html/body/div[1]/div/div[1]/div/div[3]/div/div/div/div[1]/div[1]/div[2]/div/div/div[5]/div/div[2]/div'
        var count = this.scrollCount
        while( count > 0){
            await this.autoScroll()
            await page.waitForNetworkIdle()
            console.log(`Scroll number: ${this.scrollCount - count}`)
            count--
        }
        const cars = await page.$x(card_div_path);
        const carData = []
        const links = []
        for (let car of cars) {
          // Prendiamo le informazioni della macchina
          var currentCar = {}
          try{
              currentCar["urn"] = (await car?.$eval('a', el => el?.href)).split("/")[5]
              currentCar["url"] = await car?.$eval('a', el => el?.href)
              const userData = await this.getContacts(currentCar.url)
              currentCar["advertiser_name"] = userData.user_name
              currentCar["advertiser_phone"] = userData.user_id
              currentCar["price"] = (await car?.$eval('a', el => el?.children[0]?.children[1]?.children[0]?.textContent.replaceAll("€",'').replaceAll(".", ""))).trimStart().replace(" ", "-")
              currentCar["register_year"] = await car?.$eval('a', el => el?.children[0]?.children[1]?.children[1]?.textContent.slice(0,4))
              currentCar["subject"] = await car?.$eval('a', el => el?.children[0]?.children[1]?.children[1]?.textContent.slice(4).replace(" ", ""))
              currentCar["geo_town"] = (await car?.$eval('a', el => el?.children[0]?.children[1]?.children[2]?.textContent)).trim().split(",")[0].trim()
              currentCar["geo_region"] = (await car?.$eval('a', el => el?.children[0]?.children[1]?.children[2]?.textContent)).trim().split(",")[1].trim()
              currentCar["mileage_scalar"] = (await car?.$eval('a', el => el?.children[0]?.children[1]?.children[3]?.textContent)).trim().replaceAll("km", "").replaceAll(".", "").trim()
              if(!(duplicates.includes(currentCar["urn"]))) {
                carData.push(currentCar)
                }
            }
            catch(err){
            }
        }
        await this.convertToCSV(carData, "results")
        await this.browser.close()
        return carData
    }

    autoScroll = async () => {
        await this.page.evaluate(async () => {
            await new Promise((resolve, reject) => {
                var totalHeight = 0
                var distance = window.innerHeight
                var timer = setInterval(() => {
                    var scrollHeight = document.body.scrollHeight
                    window.scrollBy(0, distance)
                    totalHeight += distance
    
                    if(totalHeight => scrollHeight){
                        clearInterval(timer)
                        resolve()
                    }
                }, 100)
            })
        })
    }

    convertToCSV = async(data, toFileName) => {
        const csvFields = Object?.keys(data[0])
        const parser = new JSON2CSVParser({fields: csvFields, delimiter: ";"})
        var csvData = parser.parse(data)
        await fsPromises.writeFile(`./Data/${toFileName}.csv`, csvData, (err) =>{
            if(err) {
                console.log(err)
                return 0
            }
            console.log("File was created successfully")
            return 1
        })
    }

    getDuplicates = async() => {
        var oldRunLinks = []
        await fsPromises.readFile('Temp/duplicates.txt', { encoding: "utf-8" })
            .then(response => oldRunLinks = JSON.parse(response))
            .catch(() => console.log('"Il file non esiste, verrà ne verrà creato uno nuovo'))
        console.log('current file length: ' + oldRunLinks.length)
        return oldRunLinks
    }

    writeDuplicates = async (newDuplicates) => {
        await fsPromises.writeFile('Temp/duplicates.txt', JSON.stringify(newDuplicates), { encoding: "utf-8" })
            .then(response => "Duplicates updated correctly")
            .catch(() => {console.log(err); return 0})
        return 1
    }

    
    getContacts = async (link) => {
        const page = await this.browser.newPage()
        await page.goto(link, { waitUntil: 'networkidle2' });
        try{
            const cookieButton = await page.$x('//*[@id="facebook"]/body/div[2]/div[1]/div/div[2]/div/div/div/div[2]/div/div[1]/div[2]/div/div[1]/div/span/span')
            cookieButton[0].click()
        }
        catch(err){}
        const elHandler = await page.$x('/html/body/div[1]/div/div[1]/div/div[3]/div/div/div/div[1]/div[1]/div[2]/div/div/div/div/div/div[2]/div/div[2]/div/div[1]/div[1]/div[7]/div/div[2]/div[1]/div/div/div/div/div[2]/div/div/div/div/span/span/div/div/a')
        let user_name = await page.evaluate(el => el.textContent, elHandler[0]);
        let user_id = (await page.evaluate(el => el.href, elHandler[0])).split("/")[5];
        page.close()
        console.log("Element evaluated")
        return {user_id, user_name}
    }
}
