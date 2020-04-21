const INSERT_COLOR = SpreadsheetApp.newColor().setRgbColor('#00FFFF').build();
const SYNC_SUCCESS = SpreadsheetApp.newColor().setRgbColor('#00FF00').build();
const DELETE_COLOR = SpreadsheetApp.newColor().setRgbColor('#FF0000').build();
const UPDATE_COLOR = SpreadsheetApp.newColor().setRgbColor('#FFFF00').build();


const INSERT = 'INSERT'
const UPDATE = 'UPDATE'
const DELETE = 'DELETE'

function getCollectionName(sheet){
  const sheetName = sheet.getName().toLowerCase();
  return sheetName; 
}

function pullDataFromFirestore() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const firestore = getFireStoreInstance();
  clearContents(sheet);
  const sheetName = sheet.getName().toLowerCase();
  Logger.log('syncing sheet ', sheetName);
  const collection = firestore.getDocuments(sheetName);
  const header = getHeader(sheet);
  
  syncDataToSheet(collection, header, sheet)
  
}

function syncDataToSheet(collection, header, sheet) {
  let completeData = new Array();
  collection.forEach(function(document){
    let row = new Array()
    const data = document['fields'];
    header.forEach(function(attr){
      const headerAttr = stripStar(attr);
      row.push(isRowStateAttribute(headerAttr) ? "" : data[headerAttr] || '');
    });
    completeData.push(row);
  });
  
  if (completeData.length > 0){
    sheet.getRange(2, 1, completeData.length, sheet.getLastColumn()).setValues(completeData);
    sheet.getRange(2, 1, completeData.length, 1).setBackgroundObject(SYNC_SUCCESS);
    
    Logger.log('Fetch From Firestore Done.')
    SpreadsheetApp.flush();
  }
}



function saveData(){
  const ui = SpreadsheetApp.getUi();

  const sheet = SpreadsheetApp.getActiveSheet();
  const lastCol = sheet.getDataRange().getLastColumn();
  const header = getHeader(sheet);
  
  const clearRowsNotation = new Array();
  const deleteRows = new Array();
  
  const lastRow = sheet.getLastRow();
  for(var i = 2; i <= lastRow; i++){
    const opsType = sheet.getRange(i, 1).getDisplayValue();
    if(opsType !== ''){
      const dataRange = sheet.getRange(i, 1, 1, lastCol);
      switch(opsType){
        case INSERT:
        case UPDATE:
          upsertToFirestore(sheet, header, dataRange, ui);
          break;
        case DELETE:
          const deletedDoc = deleteFromFirestore(sheet, dataRange);
          if (deletedDoc != null){
             clearRowsNotation.push(dataRange.getA1Notation());
             deleteRows.push(dataRange.getRow());
          }
          break;
      }
    }
  }
  if(clearRowsNotation.length > 0){
    sheet.getRangeList(clearRowsNotation).clear();
    let rowPulledUp = false;
    deleteRows.forEach(function(rowId){
      let rowToDelete = rowId;
      if (rowPulledUp){
        rowToDelete--;
      }
      sheet.deleteRow(rowToDelete);
      if (rowPulledUp === false){ rowPulledUp = true; }
    });
  }
}

function deleteFromFirestore(sheet, dataRange) {
  const collectionName = getCollectionName(sheet)
  const docId = dataRange.getValues()[0][1];
  const documentPath = collectionName + '/' + docId;
  return getFireStoreInstance().deleteDocument(documentPath);
}

function upsertToFirestore(sheet, header, dataRange, ui) {
  const collectionName = getCollectionName(sheet);
  const documentPath = collectionName + '/' +dataRange.getValues()[0][1];
  const doc = createDoc(header, dataRange.getValues()[0], ui);
  if(doc != null){
    const updatedDoc = getFireStoreInstance().updateDocument(documentPath, doc);
    syncSuccessToSheet(dataRange.getRow(), sheet);
  }
}

function syncSuccessToSheet(rowIndex, sheet) {
    sheet.getRange(rowIndex, 1, 1, 1).setValue('').setBackgroundObject(SYNC_SUCCESS);
}

function isRowStateAttribute(attribute) {
    return attribute === "stat"
}

function createDoc(header, dataRange, ui) {
  const document = {};
  let isValid = true;
  
  header.forEach(function(attribute, index) {
    const value = dataRange[index];
    if(isMandatoryField(attribute) && !isNotEmpty(value)){
        ui.alert(attribute + ' cannot be an empty value');
        isValid = false;
    }
  });
  
  if(!isValid) {
   return null; 
  }
 
  header.forEach(function(attribute, index) {
     const value = dataRange[index];
    if (!isRowStateAttribute(attribute) && isNotEmpty(value)) {
            document[stripStar(attribute)] = value;
    }
  });
    //console.log(JSON.stringify(document))
  return document;
}

function stripStar(attribute) {
 return attribute.replace('*',''); 
}

function isMandatoryField(attribute) {
   return attribute.includes('*'); 
}

function isNotEmpty(value){
 return value !== ''; 
}

          
function customOnOpen(e){
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("Backend")
  .addItem('Save Data', 'saveData')
  .addItem('Delete Data', 'deleteData')
  .addItem('Reset', 'reset')
  .addItem('Refresh', 'pullDataFromFirestore').addToUi();
  
}

function reset(){
  const lastRow = SpreadsheetApp.getActiveSheet().getDataRange().getLastRow();
  SpreadsheetApp.getActiveSheet().getRange(2, 1, lastRow-1, 1)
  .setValue('')
  .setBackgroundObject(SYNC_SUCCESS)
}

function deleteData() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const ranges = sheet.getActiveRangeList().getRanges();
  
  
  var colorRange = new Array();
  var rangeNotations = new Array();

  for(var i=0; i< ranges.length; i++){
    const range = ranges[i];
    const currentRowId = range.getRow();
    const selectedLastRow = range.getLastRow();
    let row = new Array();
    let maxRow = 1;
    if (currentRowId !== selectedLastRow){
      maxRow = selectedLastRow - currentRowId + 1;
    }
    const deleteRange = sheet.getRange(currentRowId, 1, maxRow);
    if (deleteRange.getValue() === 'INSERT') {
      sheet.deleteRow(currentRowId);
      return
    }
    deleteRange.setBackgroundObject(DELETE_COLOR);
    deleteRange.setValue(DELETE)
  }
}


function customOnEdit(e){
  console.log(JSON.stringify(e.range));
  const range = e.range;
  const sheet = SpreadsheetApp.getActiveSheet();
  
  if(e.oldValue || hasId(range, sheet)){
    const updateRange = sheet.getRange(range.getRow(), 1)
    if(isNotHeader(range) && !isInsert(updateRange)){
      updateRange.setBackgroundObject(UPDATE_COLOR);
      updateRange.setValue(UPDATE);
    }
    return
  }
  
  if((range.getLastColumn() === range.getColumn()) || isCopy(range, sheet)){
    newInsert(range, sheet);
  }  
}

function isCopy(range, sheet){
  return range.getColumn() >= 2 && range.getLastColumn() <= sheet.getDataRange().getLastColumn();
}

function newInsert(range, sheet) {
  const idRange = sheet.getRange(range.getRow(), 1,1,2);
  if(idRange.getValue() === ''){
    const id = Utilities.getUuid();
    idRange.getCell(1, 2).setValue(id);

    const statRange = idRange.getCell(1, 1)
    statRange.setBackgroundObject(INSERT_COLOR);
    statRange.setValue(INSERT);
  }
}

function getHeader(sheet) {
  var header = Array();
  const lastCol = sheet.getLastColumn();
  for(var colIndex=1; colIndex <= lastCol; colIndex++){
    const value = sheet.getRange(1, colIndex).getDisplayValue().replace(/\s/g,'_').toLowerCase();
    header.push(value);
  }
  return header;
}

function clearContents(sheet) {
  const lastCol = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();
  for(var i=2; i <= lastRow; i++){
     sheet.getRange(i, 1, 1, lastCol).clear();
  } 
}


