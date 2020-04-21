
function isDelete(e, sheet){
// return (range.getLastColumn() >= sheet.getDataRange().getLastColumn() && range.getLastColumn() < sheet.getMaxColumns()); 
  return (e.oldValue == undefined && e.value == undefined && e.range.getColumn() == 2 && e.range.getLastColumn() == 2);
}

function hasId(range,sheet){
 return sheet.getRange(range.getRow(),2).getDisplayValue() !== ''; 
}

function isInsert(range){
 return range.getValue() === INSERT;
}


function isNotHeader(range) {
 return range.getRow() !== 1; 
}