import { json_with_meta } from "../dist/run-pandoc.js";

export async function test() {
  await json_with_meta("spec/test.md").then((data) => {
    console.log(JSON.stringify(data, undefined, 2))
  })
}

export async function ipynb() {
  await json_with_meta("spec/ipython-notebooks.ipynb").then((data) => {
    console.log(JSON.stringify(data, undefined, 2))
  })
}

export async function docx() {
  await json_with_meta("spec/Have you always wanted to blog in Microsoft Word.docx")
  .then((data) => {
    console.log(JSON.stringify(data, undefined, 2))
  })
}

test()
//docx()