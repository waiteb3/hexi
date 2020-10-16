import { readLines } from "https://deno.land/std@0.69.0/io/bufio.ts"

function validate<T>(target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<T>) {
    console.log(target, propertyKey, descriptor)
    let set = descriptor.set

    Reflect.get(target, propertyKey)

    descriptor.set = function (value: T) {
        if (set === undefined) {
            return
        }
        console.log(value)
        // let type = Reflect.getMetadata("design:type", target, propertyKey);
        // if (!(value instanceof type)) {
        //     throw new TypeError("Invalid type.");
        // }
        set.call(target, value)
    }
}

class Point {
    x: number
    y: number
    constructor(x: number, y: number) {
        this.x = x
        this.y = y
    }
}

class Line {
    private _p0: Point;
    private _p1: Point;

    constructor(p0: Point, p1: Point) {
        this._p0 = p0
        this._p1 = p1
    }
  
    @validate
    set p0(value: Point) {
        this._p0 = value;
    }
    get p0() {
        return this._p0;
    }
  
    @validate
    set p1(value: Point) {
        this._p1 = value;
    }
    get p1() {
        return this._p1;
    }
}

const p0 = new Point(0, 0)
const p1 = new Point(1, 1)
const l = new Line(p0, p1)

console.log(l)

// function test(target: any, propertKey: string, descriptor: PropertyDecorator) {
//     console.log(target, propertKey, descriptor)
//     return descriptor
// }

// class Class {
//     @test
//     field: string = "asdf"
// }

// for (const obj of [Class, new Class()]) {
//     console.log( Reflect.ownKeys(obj) )
//     console.log(Reflect.get(obj, 'design:type'))
//     console.log(Reflect.get(obj, 'field'))
//     console.log(Object.getOwnPropertySymbols(obj), Object.getOwnPropertyNames(obj))
// }

// for await (const line of readLines(Deno.stdin)) {
//     console.log(line)
//     try {
//         console.log(eval(line))
//     } catch(err) {
//         console.error(err)
//     }
// }