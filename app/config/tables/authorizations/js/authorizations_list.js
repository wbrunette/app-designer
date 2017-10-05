'use strict';

var idxStart = -1;
var authorizationsResultSet = {};
var locale;
var actionAuthorizationReport = "authorizationReport";
var actionTypeKey = "actionTypeKey";


var authorizationsCBSuccess = function(result) {
    authorizationsResultSet = result;
    locale = odkCommon.getPreferredLocale();
    if (authorizationsResultSet.getCount() == 0) {
      $('#title').text(odkCommon.localizeText(locale, 'no_authorizations'));
      return null;
    } else {
      $('#title').text(odkCommon.localizeText(locale, 'choose_authorization'));
      return (function() {
        displayGroup(idxStart);
      }());
    }
};

var authorizationsCBFailure = function(error) {

    console.log('authorizations_list authorizationsCBFailure: ' + error);
};

var firstLoad = function() {

    odkCommon.registerListener(function() {
        callBackFn();
    });

    // Call the registered callback in case the notification occured before the page finished
    // loading
    callBackFn();
    resumeFn(0);
};

function callBackFn () {
    var action = odkCommon.viewFirstQueuedAction();
    console.log('callback entered with action: ' + action);

    if (action === null || action === undefined) {
        // The queue is empty
        return;
    }

    var dispatchStr = JSON.parse(action.dispatchStruct);
    if (dispatchStr === null || dispatchStr === undefined) {
        console.log('Error: missing dispatch struct');
        odkCommon.removeFirstQueuedAction();
        return;
    }

    var actionType = dispatchStr[actionTypeKey];
    console.log('callBackFn: actionType: ' + actionType);

    switch (actionType) {
        case actionAuthorizationReport:
            handleAuthorizationReportCallback(action, dispatchStr);
            odkCommon.removeFirstQueuedAction();
            break;
        default:
            console.log("Unrecognized action type in callback");
            odkCommon.removeFirstQueuedAction();
            break;
    }
}

var handleAuthorizationReportCallback = function(action, dispatchStr) {
    if (dataUtil.validateCustomTableEntry(action, dispatchStr, "authorization report", util.authorizationReportTable)) {
        // TODO: UI changes on successful completion?
    }
}


var resumeFn = function(fIdxStart) {
    var joinQuery = "SELECT * FROM " + util.authorizationTable + ' t1 LEFT JOIN ' + util.authorizationReportTable + ' t2 ON t1.report_version=t2.report_version AND t1._id=t2.authorization_id';
    //var joinQuery = 'SELECT * FROM ' + util.entitlementTable + ' t1 LEFT JOIN ' +  util.deliveryTable +
   //     ' t2 ON t2.entitlement_id = t1._id WHERE t2._id IS NULL AND t1.beneficiary_entity_id = ?';
  odkData.arbitraryQuery(util.authorizationTable, joinQuery, [], null, null,
            authorizationsCBSuccess, authorizationsCBFailure);



    idxStart = fIdxStart;
    console.log('resumeFn called. idxStart: ' + idxStart);
    // The first time through we're going to make a map of typeId to
    // typeName so that we can display the name of each shop's specialty.
    if (idxStart === 0) {
        // We're also going to add a click listener on the wrapper ul that will
        // handle all of the clicks on its children.
        $('#list').click(function(e) {
            // We set the rowId while as the li id. However, we may have
            // clicked on the li or anything in the li. Thus we need to get
            // the original li, which we'll do with jQuery's closest()
            // method. First, however, we need to wrap up the target
            // element in a jquery object.
            // wrap up the object so we can call closest()
            var jqueryObject = $(e.target);
            // we want the closest thing with class item_space, which we
            // have set up to have the row id
            var containingDiv = jqueryObject.closest('.item_space');
            var rowId = containingDiv.attr('rowId');
            var reportVersion = containingDiv.attr('reportVersion');
            var summaryFormId = containingDiv.attr('summaryFormId');
            console.log("rowId" + rowId);
            console.log("summaryFormId" + summaryFormId);
            console.log("reportVersion" + reportVersion);

            console.log('clicked with rowId: ' + rowId);
            // make sure we retrieved the rowId
            if (rowId !== null && rowId !== undefined) {
                // we'll pass null as the relative path to use the default file
                var type = util.getQueryParameter('type');
                if (type == 'override') {
                    odkTables.launchHTML(null,
                        'config/assets/html/choose_method.html?title='
                        + encodeURIComponent(odkCommon.localizeText(locale, 'choose_method'))
                        + '&secondary_manual_title='
                        + encodeURIComponent(odkCommon.localizeText(locale, 'enter_beneficiary_code'))
                        + '&type=ent_override&authorization_id=' + rowId);
                } else {
                    new Promise( function(resolve, reject) {
                        odkData.query(util.authorizationReportTable, "report_version = ? AND authorization_id = ?", [reportVersion, rowId],
                            null, null, null, null, null, null, true, resolve, reject);
                    }).then( function (result) {
                        if (result.getCount() > 0) {
                            odkTables.editRowWithSurvey(null, util.getAuthorizationReportCustomFormId(),
                                result.get('summary_row_id'), util.getAuthorizationReportCustomFormId(), null);
                        } else {
                            var rootRowId = util.genUUID();
                            var customReportRowId = util.genUUID();
                            new Promise( function(resolve, reject) {
                                var jsonMap = {};
                                util.setJSONMap(jsonMap, "authorization_id", rowId);
                                util.setJSONMap(jsonMap, "user", odkCommon.getActiveUser());
                                util.setJSONMap(jsonMap, "report_version", reportVersion);
                                util.setJSONMap(jsonMap, "summary_form_id", summaryFormId);
                                util.setJSONMap(jsonMap, "summary_row_id", customReportRowId);
                                odkData.addRow(util.authorizationReportTable, jsonMap, rootRowId, resolve, reject);
                            }).then( function(result) {
                                dataUtil.createCustomRowFromBaseEntry(result, "summary_form_id", "summary_row_id", actionAuthorizationReport, null);
                            });
                        }
                    });

                }


            }
        });
    }
};

var displayGroup = function(idxStart) {
    console.log('displayGroup called. idxStart: ' + idxStart);

    /* If the list comes back empty, inform the user */
    if (authorizationsResultSet.getCount() === 0) {
        var errorText = $('#error');
        errorText.show();
        errorText.text('No authorizations found'); // TODO: Translate this
    }

    /* Number of rows displayed per 'chunk' - can modify this value */
    console.log(authorizationsResultSet.getColumns());
    var chunk = 50;
    for (var i = idxStart; i < idxStart + chunk; i++) {
        if (i >= authorizationsResultSet.getCount()) {
            break;
        }

        var item = $('<li>');
        item.attr('rowId', authorizationsResultSet.getRowId(i));
        item.attr('summaryFormId', authorizationsResultSet.getData(i, "summary_form_id"));
        item.attr('reportVersion', authorizationsResultSet.getData(i, "report_version"));
        item.attr('summaryFormId', authorizationsResultSet.getData(i, "summary_form_id"));
        item.attr('class', 'item_space');
        var auth_name = authorizationsResultSet.getData(i, 'authorization_name');
        item.text(auth_name);

        var chevron = $('<img>');
        chevron.attr('class', 'chevron');
        //authorization_id is only in the report table, so this is how we tell if there is an entry for this report version
        if (authorizationsResultSet.getData(i, 'authorization_id') === null) {
            chevron.attr('src', odkCommon.getFileAsUrl('config/assets/img/little_arrow.png'));
        } else {
            chevron.attr('src', odkCommon.getFileAsUrl('config/assets/img/checkmark.png'));
        }
        item.append(chevron);

        var field2 = $('<li>');
        field2.attr('class', 'detail')
        var itemPack = authorizationsResultSet.getData(i, 'item_pack_name');
        field2.text(itemPack);
        item.append(field2);


        $('#list').append(item);

        // don't append the last one to avoid the fencepost problem
        var borderDiv = $('<div>');
        borderDiv.addClass('divider');
        $('#list').append(borderDiv);
    }

    if (i < authorizationsResultSet.getCount()) {
        setTimeout(resumeFn, 0, i);
    }

};