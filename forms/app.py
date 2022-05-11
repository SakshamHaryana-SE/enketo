import os

from flask import Flask, render_template, request, send_from_directory

import requests
import xml.etree.ElementTree as et
from flask_cors import CORS, cross_origin

app = Flask(__name__)
cors = CORS(app)

url = "http://143.110.183.73:15003/v1/graphql"

headers = {
    'x-hasura-admin-secret': '4GeEB2JCU5rBdLvQ4AbeqqrPGu7kk9SZDhJUZm7A',
    'Content-Type': 'application/json'
}


def read_text_file(file_path):
    with open(file_path, 'r') as f:
        return f.read()


@app.route('/')
def hello_world():  # put application's code here
    abs_path = os.path.join(app.root_path, 'static/forms')
    print(abs_path)
    files = os.listdir(abs_path)
    print(files)
    return render_template('files.html', files=files)


@app.route('/getForm/<formId>')
@cross_origin()
def get_Form(formId):
    # print(formId)
    return send_from_directory(app.root_path, "static/forms/" + formId+ ".xml")


@app.route('/getFormPrefilled/<assessmentBuilderId>', methods=["GET"])
@cross_origin()
def get_Form_Prefilled(assessmentBuilderId):
    formId = "SOE"    
    payload = """query {
      assessment(where: {id: {_eq: %id}}) {
        assessment_builder {
          xml_string
        }
      }
    }
    """
    payload = payload.replace("%id", assessmentBuilderId)
    xml_form = read_text_file(f"{app.root_path}/static/forms/{formId}.xml")
    starting = xml_form.find("<data")
    ending = xml_form.find("data>") + 5    
        
    print(starting)
    print(ending)
    response = requests.request(
        "POST", url, headers=headers, json={"query": payload})    
    if response.status_code == 200:        
        xml_string = response.json(
        )        
    else:
        raise Exception(f"Query failed to run with a {response.status_code}.")

    def parseXML(file):
        tree = et.parse(file)
        root = tree.getroot()
        return root

    def get_concatenated_data_xml():        
        return str(xml_form[:starting]) + str(xml_string) + str(xml_form[ending:])

    form = parseXML(f"{app.root_path}/static/forms/{formId}.xml")[0][1][0][0]    
    xml = et.fromstring(get_concatenated_data_xml())   

    def find_node(node, tag_name):
        if node.tag == tag_name:
            return node
        for child in node:
            result = find_node(child, tag_name)
            if result is not None:
                return result

    def merge(node):
        info_found = find_node(xml, node.tag)
        if info_found is not None:
            node.text = info_found.text
        for child in node:
            merge(child)

    merge(form)

    et.register_namespace('', "http://www.w3.org/2002/xforms")
    et.register_namespace('ev', "http://www.w3.org/2001/xml-events")
    et.register_namespace('h', "http://www.w3.org/1999/xhtml")
    et.register_namespace('jr', "http://openrosa.org/javarosa")
    et.register_namespace('odk', "http://www.opendatakit.org/xforms")
    et.register_namespace('orx', "http://openrosa.org/xforms")
    et.register_namespace('xsd', "http://www.w3.org/2001/XMLSchema")

    concatenated_form = et.tostring(form, encoding="unicode")
    final_prefilled_form = xml_form[:starting] + concatenated_form + xml_form[ending:]
    with open(f"{app.root_path}/static/forms/{assessmentBuilderId}.xml", "w") as f:
        f.write(final_prefilled_form)
    return "OK"


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
