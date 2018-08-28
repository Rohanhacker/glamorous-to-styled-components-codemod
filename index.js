const _ = require("lodash");

/**
 * glamorous-to-styled-components-codemod
 */

module.exports = function(babel) {
  const { types: t, template } = babel;
  return {
    visitor: {
      ImportDeclaration(path, { opts }) {
        if (path.node.source.value !== "glamorous") {
          return;
        }
        // First, check for ThemeProvider and update that.
        const themeProviderIndex = path.node.specifiers.findIndex(
          specifier => specifier.local.name === "ThemeProvider"
        );

        const specifiers = [t.importDefaultSpecifier(t.identifier("styled"))];

        if (~themeProviderIndex) {
          specifiers.push(
            t.importSpecifier(
              t.identifier("ThemeProvider"),
              t.identifier("ThemeProvider")
            )
          );
        }
        path.replaceWith(
          t.importDeclaration(specifiers, t.stringLiteral("styled-components"))
        );
      },
      // convert jsx glamorous elements to normal elements
      JSXElement(path) {
        const node = path.node;
        const openingElem = node.openingElement;
        const closingElem = node.closingElement;
        if (openingElem.name.type !== "JSXMemberExpression") return;
        if (openingElem.name.object.name !== "glamorous") return;
        const styleObjList = [];
        openingElem.attributes.forEach(attr => {
          let value = attr.value.value;
          const name = attr.name.name;
          if (attr.value.expression) {
            value = `${attr.value.expression.value}px`;
          }
          styleObjList.push(
            t.objectProperty(t.StringLiteral(name), t.StringLiteral(value))
          );
        });
        openingElem.name = t.identifier(
          openingElem.name.property.name.toLowerCase()
        );

        const styledExp = t.JSXExpressionContainer(
          t.ObjectExpression(styleObjList)
        );
        openingElem.attributes = [
          t.JSXAttribute(t.JSXIdentifier("style"), styledExp)
        ];
        closingElem.name = t.identifier(
          closingElem.name.property.name.toLowerCase()
        );
      },
      // convert glamorous to styled components
      CallExpression(path) {
        if (
          t.isIdentifier(path.node.callee) &&
          path.node.callee.name === "glamorous"
        ) {
          return;
        }
        if (!t.isMemberExpression(path.node.callee)) {
          return;
        }
        if (path.node.callee.object.name !== "glamorous") {
          return;
        }
        const args = path.node.arguments;
        if (args.find(arg => arg.type === "ArrowFunctionExpression")) return;
        const callee = path.node.callee.property.name;
        const fn = t.MemberExpression(
          t.Identifier("styled"),
          t.Identifier(callee)
        );
        let template = "";
        args.map(arg => {
          arg.properties.map(a => {
            let val = "";
            let key = "";
            if (a.value.type === "NumericLiteral") {
              val = `${a.value.value}px`;
              key = _.kebabCase(a.key.name);
            } else if (a.value.type === "StringLiteral") {
              val = a.value.value;
              key = _.kebabCase(a.key.name);
            } else {
              if (a.value.type === "ObjectExpression") {
                let pseudo = "";
                _.forEach(a.value.properties, (val, key) => {
                  pseudo += `${_.kebabCase(val.key.name)}: ${val.value.value}; `;
                });
                key = `&${a.key.value}`;
                template = template.concat(`${key}: { ${pseudo} } `);
              }
              return;
            }
            template = template.concat(`${_.kebabCase(a.key.name)}: ${val};`);
          });
        });

        path.replaceWithMultiple(
          t.TaggedTemplateExpression(
            fn,
            t.TemplateLiteral([t.TemplateElement({ raw: template })], [])
          )
        );
      }
    }
  };
};
