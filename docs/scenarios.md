#Dashboard Scenarios

## Define Data Source


## Build a Chart

User selects New Chart from drop down on a frame on the page (...) or vertical three dots.
A dialog box comes up:
    d-agent tells the user what types of things it can do.
    d-agent gives user url to echarts library so they can see what is possible. 
    user tells the chat engine what they would like in natural terms.
    "I would like a line chart displaying the temperature. over time, for the last couple of days."
    "I would like to be able to select the facility from a drop down."

dashboard-agent uses the mcp-tools to understand what datasources are available.
d-agent uses its ability to create code and understand react components to create a component d-agent uses the create-component mcp-tools to push the tool to the d-server
d-server validates the schema and checks for known vulnerabilities.  
d-server sends a notification to the d-client (through socket) notifying the user that an updated chart is available.  
d-client loads the component, the component attaches to the datasource and presents the data to the user
   
## Make changes to a chart. 
User selects Update Chart from dropdown on existing component
Chat dialog box opens up after component id is send to d-agent
d-agent tells the user a little about the component and then asks the user what they would like to change
user tells d-agent what they would like changed. d-agent pushes component to d-server. 
d-server validates the component and forwards it to the d-client
d-client displays the new component with the currently cached data.

## 