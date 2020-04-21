import { getFireStoreInstance } from "./Firestore";

const COLOR_CREATED = SpreadsheetApp.newColor().setRgbColor('#FFFF00').build();
const COLOR_CLOSED = SpreadsheetApp.newColor().setRgbColor('#00FF00').build();


function loadData() {
    const documents = getFireStoreInstance().getDocuments('requests');
    const suppliers: Map<string, string> = new Map<string, string>();
    const volunteers: Map<string, string> = new Map<string, string>();

    const allRows = new Array<any>();
    const allColors = new Array<any>();

    const colorCreatedRange = getColorRange(COLOR_CREATED);
    const colorClosedRange = getColorRange(COLOR_CLOSED);

    documents.forEach(document => {
        const fields = document.fields;
        const extractedRows = valueFromColumns(fields, suppliers, volunteers)
        for(let i = 0; i < extractedRows.length; i+=2) {
            allRows.push(extractedRows[i]);
            const color = extractedRows[i+1];
            console.log(String(color === COLOR_CREATED));
           if (color === COLOR_CREATED){
               allColors.push(colorCreatedRange);
           }else if(color === COLOR_CLOSED) {
               allColors.push(colorClosedRange);
           }
        }
    });

    let sheet = SpreadsheetApp.getActiveSheet();
    sheet.getRange(2, 1, allRows.length, 17).setValues(allRows);
    sheet.getRange(2, 1, allColors.length, 17).setBackgroundObjects(allColors);
}

function getColorRange(color) {
    const allColors = new Array<any>();

    for(let j= 0; j < 17; j++) {
        allColors.push(color);
    }
    return allColors;
}

function valueFromColumns(fields, suppliers: Map<string, string>, volunteers: Map<string, string>) {
    const allRows = Array();
    const uid = fields.uid
    const createdTimestamp = fields.createdTimestamp
    const kitDescription = fields.kit.description
    const kitType = fields.kit.type
    const location = fields.location
    const address = location.address
    const contactName = location.contactName
    const landmark = location.landmark
    const phone = location.phone
    const pincode = location.pincode
    const status = fields.status
    const supplierId = fields.supplierId;
    const volunteerId = fields.volunteerId;
    const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone()

    const supplierName = getSupplierName(supplierId, suppliers)
    const volunteerName = getVolunteerName(volunteerId, volunteers)


    const families = fields.families
    families.forEach(family => {
        const row = new Array();
        // const color = new Array();
        row.push(uid);
        row.push(getDate(createdTimestamp, tz));
        row.push(family.contact)
        row.push(family.familyLeader)
        row.push(family.noOfAdults)
        row.push(family.noOfChildren)
        row.push(family.noOfKits)
        row.push(kitDescription)
        row.push(kitType)
        row.push(address)
        row.push(contactName)
        row.push(landmark)
        row.push(phone)
        row.push(pincode)
        row.push(status)
        row.push(supplierName)
        row.push(volunteerName)
        let color;
        if (status === 'CREATED') {
            color = (COLOR_CREATED);
        }else if(status === 'CLOSED') {
            color = (COLOR_CLOSED);
        }
        allRows.push(row)
        allRows.push(color);
    });
    return allRows;
}

function getDate(createdTimestamp: any, tz: string) {
    if (createdTimestamp && createdTimestamp !== 0) {
        return Utilities.formatDate(new Date(createdTimestamp), tz, 'dd-MM-yyyy hh:mm:ss');
    }
    return ''
}

function getSupplierName(supplierId: string, suppliers: Map<string, string>): string {
    return getNameFromDocument_('suppliers/' + supplierId, supplierId, suppliers)
}

function getVolunteerName(volunteerId: string, volunteers: Map<string, string>): string {
    return getNameFromDocument_('volunteers/' + volunteerId, volunteerId, volunteers)
}

function getNameFromDocument_(documentPath: string, key: string, cache: Map<string, string>) {
    if (key === null || key === "") { return "" }
    let value = ""
    if (cache.get(key)) {
        value = cache.get(key);
    } else {
        const document = getFireStoreInstance().getDocument(documentPath)
        if (document.fields) {
            const docFields = document.fields
            cache.set(key, docFields.name)
        }
    }
    return value
}


export function customOnOpen(e) {
    let ui = SpreadsheetApp.getUi()
    ui.createMenu('Backend')
        .addItem('Fetch Report', 'loadData')
        .addItem('Reset', 'reset').addToUi();
}

function reset() {
    const sheet = SpreadsheetApp.getActiveSheet()
    const lastRow = sheet.getDataRange().getLastRow()
    sheet.deleteRows(3, lastRow - 1)

}