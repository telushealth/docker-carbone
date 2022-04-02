function setLoading(state) {
    const initial = document.getElementById('initial');
    if (!initial) { return }

    if (state) {
        initial.innerHTML = '<td colspan="3" align="center">Loading...</td>';
    } else {
        initial.innerHTML = '<td colspan="3" align="center">Tidak ada data</td>';
    }
}

function setContent(data) {
    const tbody = document.getElementById('tbody')
    const select = document.getElementById('template')
    tbody.innerHTML = ''
    select.innerHTML = '<option value="">--SELECT--</option>'
    data.forEach((file, i) => {
        tbody.innerHTML += `
            <tr>
                <th>${i + 1}</th>
                <td>${file}</td>
                <td>
                    <button class="btn btn-primary btn-sm test" data-file="${file}">Test</button>
                    <button type="submit" class="btn btn-secondary btn-sm" onclick="window.open('/download/${file}')">Download</button>
                    <button class="btn btn-danger btn-sm delete" data-file="${file}">Delete</button>
                </td>
            </tr>
        `
        select.innerHTML += `<option>${file}</option>`
    });

    const deletes = document.getElementsByClassName("delete");
    for (let btn of deletes) {
        btn.addEventListener('click', askDelete)
    }
    const tests = document.getElementsByClassName("test");
    for (let btn of tests) {
        btn.addEventListener('click', testTemplate)
    }
}

async function getData () {
    try {
        setLoading(true)
        const response = await fetch('/template', { method: "GET" })
        if (response.status === 200) {
            const data = await response.json()
            if (data && data.length) {
                setContent(data)
            }
        }
    } finally {
        setLoading(false)
    }
}

const btnUpload = document.getElementById('upload')
btnUpload.addEventListener('click', uploadFile)
async function uploadFile() {
    const file = document.getElementById('inputFile')
    if (file.files.length !== 1) {
        window.alert('invalid input value')
        return
    }

    let formData = new FormData();           
    formData.append("template", file.files[0]);
    try {
        await fetch('/template', {
          method: "POST", 
          body: formData
        })
        file.value = ''
        const modalEL = document.getElementById('modal');
        const modal = bootstrap.Modal.getInstance(modalEL)
        modal.hide();
        getData();
    } catch (error) {
        window.alert('Error upload file')
    }
}

async function askDelete (e) {
    const ask = window.confirm('Are you sure?')
    if (ask) {
        const target = e.target
        const file = target.getAttribute('data-file')
        try {
            await fetch(`/template/${file}`, {
              method: "DELETE"
            })
            getData();
        } catch (error) {
            window.alert('Error delete file')
        }
    }
}

async function testTemplate (e) {
    const target = e.target
    const file = target.getAttribute('data-file')
    const template = document.getElementById('template')
    const filename = document.getElementById('filename')
    const json = document.getElementById('json')
    const options = document.getElementById('options')
    template.value = file
    filename.value = `test-${file}`
    json.value = '{}'
    options.value = '{}'
    setTimeout(() => {
        const modalEL = document.getElementById('modal-test');
        const modal = new bootstrap.Modal(modalEL)
        modal.show();
    }, 10)
}

const btnTest = document.getElementById('test')
btnTest.addEventListener('click', downloadTest)
async function downloadTest () {
    const template = document.getElementById('template')
    const filename = document.getElementById('filename')
    const json = document.getElementById('json')
    const options = document.getElementById('options')
    const data = {
        template: template.value,
        filename: filename.value,
        json: JSON.parse(json.value),
        options: JSON.parse(options.value),
    }
    try {
        const response = await fetch('/generate?download=true', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        })

        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename.value
        document.body.appendChild(a);
        a.click();    
        a.remove();

        const modalEL = document.getElementById('modal-test');
        const modal = bootstrap.Modal.getInstance(modalEL)
        modal.hide();
        getData();
    } catch (error) {
        console.log(error)
        window.alert('Error test template')
    }
}
getData()
